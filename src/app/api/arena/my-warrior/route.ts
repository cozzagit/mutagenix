import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, creatureRankings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getRankTier } from '@/lib/game-engine/battle-engine';
import { creatureToBattleCreature } from '@/lib/game-engine/battle-helpers';

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

  // Get active creature
  const [creature] = await db
    .select()
    .from(creatures)
    .where(
      and(
        eq(creatures.userId, session.userId),
        eq(creatures.isArchived, false),
      ),
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

  // Calculate battle stats
  const battleCreature = creatureToBattleCreature(creature, ranking);
  const hp = calculateMaxHp(battleCreature);
  const dominantPersonality = getDominantPersonality(battleCreature);

  const now = new Date();
  const inRecovery = ranking.recoveryUntil ? ranking.recoveryUntil > now : false;
  const recoveryRemainingMs = inRecovery && ranking.recoveryUntil
    ? ranking.recoveryUntil.getTime() - now.getTime()
    : 0;

  // Reset battlesToday if from previous day
  let battlesToday = ranking.battlesToday;
  if (
    ranking.lastBattleAt &&
    ranking.lastBattleAt.toDateString() !== now.toDateString()
  ) {
    battlesToday = 0;
  }

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
      battlesToday,
      battlesRemaining: Math.max(0, 5 - battlesToday),
      visualParams: creature.visualParams,
    },
  });
}
