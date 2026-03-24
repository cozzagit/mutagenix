import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, creatureRankings, users, battles } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { getRankTier } from '@/lib/game-engine/battle-engine';
import { creatureToBattleCreature } from '@/lib/game-engine/battle-helpers';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import type { TraitValues, ElementLevels } from '@/types/game';
import { loadWellnessInput } from '@/lib/game-engine/wellness-loader';
import { calculateWellness } from '@/lib/game-engine/wellness';

/** Calculate how much AXP a creature should lose due to inactivity. */
function calculateAxpDecay(lastBattleAt: Date | null, currentAxp: number): number {
  if (!lastBattleAt || currentAxp <= 0) return 0;
  const daysSince = (Date.now() - lastBattleAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 3) return 0;
  const decayDays = Math.floor(daysSince - 3);
  return Math.min(currentAxp, decayDays * 2);
}

type PersonalityTrait = 'aggression' | 'luminosity' | 'toxicity' | 'intelligence' | 'armoring';

function getDominantPersonality(levels: {
  aggressionLevel: number;
  luminosityLevel: number;
  toxicityLevel: number;
  intelligenceLevel: number;
  armoringLevel: number;
}): PersonalityTrait {
  const traits: [PersonalityTrait, number][] = [
    ['aggression', levels.aggressionLevel],
    ['luminosity', levels.luminosityLevel],
    ['toxicity', levels.toxicityLevel],
    ['intelligence', levels.intelligenceLevel],
    ['armoring', levels.armoringLevel],
  ];
  traits.sort((a, b) => b[1] - a[1]);
  return traits[0][0];
}

function calculateMaxHp(bc: {
  bodySize: number;
  stamina: number;
  defense: number;
  armoringLevel: number;
  battleScars: number;
}): number {
  return (
    bc.bodySize * 2 +
    bc.stamina * 3 +
    bc.defense * 1.5 +
    bc.armoringLevel * 50 +
    bc.battleScars * 2
  );
}

export async function GET() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  // Get active creature (use active_creature_id if set)
  const [user] = await db.select({ activeCreatureId: users.activeCreatureId })
    .from(users).where(eq(users.id, session.userId));

  const [creature] = user?.activeCreatureId
    ? await db.select().from(creatures).where(eq(creatures.id, user.activeCreatureId))
    : await db.select().from(creatures).where(
        and(eq(creatures.userId, session.userId), eq(creatures.isArchived, false)),
      );

  if (!creature) {
    return NextResponse.json(
      { error: { code: 'NO_CREATURE', message: 'Non hai una creatura attiva.' } },
      { status: 404 },
    );
  }

  if ((creature.ageDays ?? 0) < 40) {
    return NextResponse.json(
      { error: { code: 'NOT_WARRIOR', message: 'La tua creatura non ha raggiunto la fase guerriero (giorno 40).' } },
      { status: 422 },
    );
  }

  const tier = getRankTier(creature.ageDays ?? 0);

  // Get or create ranking
  let [ranking] = await db
    .select()
    .from(creatureRankings)
    .where(eq(creatureRankings.creatureId, creature.id));

  if (!ranking) {
    [ranking] = await db
      .insert(creatureRankings)
      .values({
        creatureId: creature.id,
        userId: session.userId,
        eloRating: 1000,
        eloPeak: 1000,
        rankTier: tier,
      })
      .returning();
  }

  // Apply AXP decay before returning
  const axpDecay = calculateAxpDecay(ranking.lastBattleAt, ranking.axp);
  if (axpDecay > 0) {
    ranking = {
      ...ranking,
      axp: ranking.axp - axpDecay,
    };
    await db.update(creatureRankings)
      .set({ axp: ranking.axp })
      .where(eq(creatureRankings.creatureId, creature.id));
  }

  // Calculate battle stats
  const battleCreature = creatureToBattleCreature(creature, ranking);
  const hp = calculateMaxHp(battleCreature);
  const dominantPersonality = getDominantPersonality(battleCreature);

  const now = new Date();
  const inRecovery = ranking.recoveryUntil ? ranking.recoveryUntil > now : false;
  const recoveryRemainingMs = inRecovery && ranking.recoveryUntil
    ? ranking.recoveryUntil.getTime() - now.getTime()
    : 0;

  // Count only ATTACKS today (not received battles)
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const [attackCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(battles)
    .where(
      and(
        eq(battles.challengerUserId, session.userId),
        gte(battles.createdAt, todayStart),
      ),
    );
  const battlesToday = attackCountResult?.count ?? 0;

  return NextResponse.json({
    data: {
      creatureId: creature.id,
      name: creature.name,
      ageDays: creature.ageDays,
      // Ranking
      eloRating: ranking.eloRating,
      eloPeak: ranking.eloPeak,
      wins: ranking.wins,
      losses: ranking.losses,
      draws: ranking.draws,
      winStreak: ranking.winStreak,
      bestWinStreak: ranking.bestWinStreak,
      tier,
      // Combat stats
      hp: Math.round(hp),
      attackPower: Math.round(battleCreature.attackPower),
      defense: Math.round(battleCreature.defense),
      speed: Math.round(battleCreature.speed),
      stamina: Math.round(battleCreature.stamina),
      specialAttack: Math.round(battleCreature.specialAttack),
      battleScars: battleCreature.battleScars,
      // Personality
      dominantPersonality,
      personality: {
        aggression: Math.round(battleCreature.aggressionLevel * 1000) / 1000,
        luminosity: Math.round(battleCreature.luminosityLevel * 1000) / 1000,
        toxicity: Math.round(battleCreature.toxicityLevel * 1000) / 1000,
        intelligence: Math.round(battleCreature.intelligenceLevel * 1000) / 1000,
        armoring: Math.round(battleCreature.armoringLevel * 1000) / 1000,
      },
      // Synergies
      activeSynergies: battleCreature.activeSynergies,
      // Status
      recovery: {
        active: inRecovery,
        remainingMinutes: inRecovery ? Math.ceil(recoveryRemainingMs / 60000) : 0,
        until: ranking.recoveryUntil?.toISOString() ?? null,
      },
      trauma: {
        active: ranking.traumaActive,
        consecutiveLosses: ranking.consecutiveLosses,
      },
      axp: ranking.axp,
      stability: creature.stability ?? 0.5,
      battlesToday,
      battlesRemaining: Math.max(0, 10 - battlesToday),
      wellness: await loadWellnessInput(creature.id, { lastBattleAt: ranking.lastBattleAt, battlesToday })
        .then(calculateWellness),
      visualParams: mapTraitsToVisuals(
        creature.traitValues as TraitValues,
        creature.elementLevels as ElementLevels,
        [],
        creature.foundingElements ?? null,
        creature.growthElements ?? null,
      ) as unknown as Record<string, unknown>,
    },
  });
}
