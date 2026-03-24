import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, creatureRankings, battles, users } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { ArenaPage } from '@/components/arena/arena-page';
import { ArenaRegistration } from '@/components/arena/arena-registration';
import { creatureToBattleCreature } from '@/lib/game-engine/battle-helpers';
import { getRankTier } from '@/lib/game-engine/battle-engine';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import type { TraitValues, ElementLevels } from '@/types/game';

export const dynamic = 'force-dynamic';

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

export default async function ArenaMainPage() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    redirect('/login');
  }

  // Mark arena as visited — clears unseen battle notifications
  await db.update(users).set({ lastArenaVisit: new Date() }).where(eq(users.id, session.userId)).catch(() => {});

  // Get user's active creature
  // Use active_creature_id if set
  const [arenaUser] = await db.select({ activeCreatureId: users.activeCreatureId })
    .from(users).where(eq(users.id, session.userId));

  const [creature] = arenaUser?.activeCreatureId
    ? await db.select().from(creatures).where(eq(creatures.id, arenaUser.activeCreatureId))
    : await db.select().from(creatures).where(
        and(eq(creatures.userId, session.userId), eq(creatures.isArchived, false)),
      );

  if (!creature) {
    redirect('/lab');
  }

  const ageDays = creature.ageDays ?? 0;

  // Not ready for arena (< day 40)
  if (ageDays < 40) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="flex flex-col items-center text-center">
          <div className="rounded-full bg-surface-2 p-4 mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-12 w-12 text-muted">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-foreground mb-2">
            Non ancora pronto
          </h1>
          <p className="text-sm text-muted mb-2">
            La tua creatura deve raggiungere il <strong className="text-foreground">Giorno 40</strong> per entrare nella fase guerriero e accedere all&apos;Arena.
          </p>
          <p className="text-xs text-muted">
            Giorno attuale: <strong className="text-foreground">{ageDays}</strong> / 40
          </p>
          <div className="w-full max-w-xs mt-4">
            <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-danger/60 transition-all"
                style={{ width: `${Math.min(100, (ageDays / 40) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted mt-1">
              {40 - ageDays} giorni rimanenti
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check if registered in arena
  const [ranking] = await db
    .select()
    .from(creatureRankings)
    .where(eq(creatureRankings.creatureId, creature.id));

  // Not registered yet — show registration prompt
  if (!ranking) {
    return (
      <ArenaRegistration
        creatureName={creature.name}
        visualParams={mapTraitsToVisuals(creature.traitValues as TraitValues, creature.elementLevels as ElementLevels, [], creature.foundingElements ?? null, creature.growthElements ?? null) as unknown as Record<string, unknown>}
      />
    );
  }

  // Apply AXP decay on page load
  const axpDecay = (() => {
    if (!ranking.lastBattleAt || ranking.axp <= 0) return 0;
    const daysSince = (Date.now() - ranking.lastBattleAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 3) return 0;
    const decayDays = Math.floor(daysSince - 3);
    return Math.min(ranking.axp, decayDays * 2);
  })();

  if (axpDecay > 0) {
    const newAxp = ranking.axp - axpDecay;
    await db.update(creatureRankings)
      .set({ axp: newAxp })
      .where(eq(creatureRankings.creatureId, creature.id));
    // Update local reference for use below
    (ranking as Record<string, unknown>).axp = newAxp;
  }

  // Registered — build warrior data for the ArenaPage component
  const tier = getRankTier(ageDays);
  const battleCreature = creatureToBattleCreature(creature, ranking);
  const hp = calculateMaxHp(battleCreature);
  const dominantPersonality = getDominantPersonality(battleCreature);

  const now = new Date();
  const inRecovery = ranking.recoveryUntil ? ranking.recoveryUntil > now : false;
  const recoveryRemainingMs = inRecovery && ranking.recoveryUntil
    ? ranking.recoveryUntil.getTime() - now.getTime()
    : 0;

  let battlesToday = ranking.battlesToday;
  if (
    ranking.lastBattleAt &&
    ranking.lastBattleAt.toDateString() !== now.toDateString()
  ) {
    battlesToday = 0;
  }

  const warriorData = {
    creatureId: creature.id,
    name: creature.name,
    ageDays: creature.ageDays,
    eloRating: ranking.eloRating,
    eloPeak: ranking.eloPeak,
    wins: ranking.wins,
    losses: ranking.losses,
    draws: ranking.draws,
    winStreak: ranking.winStreak,
    bestWinStreak: ranking.bestWinStreak,
    tier,
    hp: Math.round(hp),
    attackPower: Math.round(battleCreature.attackPower),
    defense: Math.round(battleCreature.defense),
    speed: Math.round(battleCreature.speed),
    stamina: Math.round(battleCreature.stamina),
    specialAttack: Math.round(battleCreature.specialAttack),
    battleScars: battleCreature.battleScars,
    dominantPersonality,
    personality: {
      aggression: Math.round(battleCreature.aggressionLevel * 1000) / 1000,
      luminosity: Math.round(battleCreature.luminosityLevel * 1000) / 1000,
      toxicity: Math.round(battleCreature.toxicityLevel * 1000) / 1000,
      intelligence: Math.round(battleCreature.intelligenceLevel * 1000) / 1000,
      armoring: Math.round(battleCreature.armoringLevel * 1000) / 1000,
    },
    activeSynergies: battleCreature.activeSynergies,
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
    visualParams: mapTraitsToVisuals(creature.traitValues as TraitValues, creature.elementLevels as ElementLevels, [], creature.foundingElements ?? null, creature.growthElements ?? null) as unknown as Record<string, unknown>,
  };

  // lastArenaVisit was already set to now() at the top of this function,
  // so there are no "unseen" battles by definition when viewing the arena.
  return <ArenaPage warrior={warriorData} unseenDefenderBattles={0} />;
}
