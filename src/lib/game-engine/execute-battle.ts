// ---------------------------------------------------------------------------
// Mutagenix – Execute Battle (shared battle executor)
// ---------------------------------------------------------------------------
// Runs a full ranked battle between two creatures: battle calculation, DB save,
// consequences, ELO, AXP, recovery. Used by both the challenge API and the
// bot auto-battle cron.
// ---------------------------------------------------------------------------

import { db } from '@/lib/db';
import {
  creatures,
  creatureRankings,
  battles,
  type TraitValues,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { creatureToBattleCreature } from '@/lib/game-engine/battle-helpers';
import {
  calculateBattle,
  applyBattleConsequences,
  calculateEloChange,
  getRankTier,
} from '@/lib/game-engine/battle-engine';
import { TIME_CONFIG } from '@/lib/game-engine/time-config';
import type { RankTier } from '@/types/battle';
import type { Creature } from '@/lib/db/schema/creatures';
import type { CreatureRanking } from '@/lib/db/schema/creature-rankings';
import { loadWellnessInput } from './wellness-loader';
import { calculateWellness } from './wellness';
import { getCreatureCariche } from './cariche-loader';

// ---------------------------------------------------------------------------
// AXP helpers
// ---------------------------------------------------------------------------

function calculateAxpDecay(lastBattleAt: Date | null, currentAxp: number): number {
  if (!lastBattleAt || currentAxp <= 0) return 0;
  const daysSince = (Date.now() - lastBattleAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 3) return 0;
  const decayDays = Math.floor(daysSince - 3);
  return Math.min(currentAxp, decayDays * 2);
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface ExecuteBattleResult {
  battleId: string;
  winnerId: string | null;
  challengerElo: number;
  defenderElo: number;
  challengerEloDelta: number;
  defenderEloDelta: number;
  challengerName: string;
  defenderName: string;
  rounds: number;
  isDraw: boolean;
}

// ---------------------------------------------------------------------------
// Main executor
// ---------------------------------------------------------------------------

/**
 * Execute a full ranked battle between two creatures.
 * Handles: battle calculation, saving to DB, consequences, ELO, AXP, recovery.
 *
 * Both creatures must exist, be unarchived, and the caller is responsible for
 * pre-validating eligibility (recovery, tier, daily limits, etc.).
 */
export async function executeBattle(
  challengerCreature: Creature,
  defenderCreature: Creature,
  challengerUserId: string,
  defenderUserId: string,
): Promise<ExecuteBattleResult> {
  const now = new Date();
  const challengerTier = getRankTier(challengerCreature.ageDays ?? 0);
  const defenderTier = getRankTier(defenderCreature.ageDays ?? 0);

  // --- Get or create rankings ---
  let [challengerRanking] = await db
    .select()
    .from(creatureRankings)
    .where(eq(creatureRankings.creatureId, challengerCreature.id));

  if (!challengerRanking) {
    [challengerRanking] = await db
      .insert(creatureRankings)
      .values({
        creatureId: challengerCreature.id,
        userId: challengerUserId,
        eloRating: 1000,
        eloPeak: 1000,
        rankTier: challengerTier,
      })
      .returning();
  }

  let [defenderRanking] = await db
    .select()
    .from(creatureRankings)
    .where(eq(creatureRankings.creatureId, defenderCreature.id));

  if (!defenderRanking) {
    [defenderRanking] = await db
      .insert(creatureRankings)
      .values({
        creatureId: defenderCreature.id,
        userId: defenderUserId,
        eloRating: 1000,
        eloPeak: 1000,
        rankTier: defenderTier,
      })
      .returning();
  }

  // --- Apply AXP decay ---
  const challengerAxpDecay = calculateAxpDecay(challengerRanking.lastBattleAt, challengerRanking.axp);
  if (challengerAxpDecay > 0) {
    challengerRanking = {
      ...challengerRanking,
      axp: challengerRanking.axp - challengerAxpDecay,
    };
    await db.update(creatureRankings)
      .set({ axp: challengerRanking.axp })
      .where(eq(creatureRankings.creatureId, challengerCreature.id));
  }

  const defenderAxpDecay = calculateAxpDecay(defenderRanking.lastBattleAt, defenderRanking.axp);
  if (defenderAxpDecay > 0) {
    defenderRanking = {
      ...defenderRanking,
      axp: defenderRanking.axp - defenderAxpDecay,
    };
    await db.update(creatureRankings)
      .set({ axp: defenderRanking.axp })
      .where(eq(creatureRankings.creatureId, defenderCreature.id));
  }

  // --- Load cariche for both creatures ---
  const [challengerCariche, defenderCariche] = await Promise.all([
    getCreatureCariche(challengerCreature.id),
    getCreatureCariche(defenderCreature.id),
  ]);

  // --- Load wellness for both creatures ---
  const [challengerWellnessInput, defenderWellnessInput] = await Promise.all([
    loadWellnessInput(challengerCreature.id, {
      lastBattleAt: challengerRanking.lastBattleAt,
      battlesToday: challengerRanking.battlesToday,
    }),
    loadWellnessInput(defenderCreature.id, {
      lastBattleAt: defenderRanking.lastBattleAt,
      battlesToday: defenderRanking.battlesToday,
    }),
  ]);
  const challengerWellness = calculateWellness(challengerWellnessInput);
  const defenderWellness = calculateWellness(defenderWellnessInput);

  // --- Run battle ---
  const challengerBattle = creatureToBattleCreature(challengerCreature, challengerRanking, challengerWellness, challengerCariche);
  const defenderBattle = creatureToBattleCreature(defenderCreature, defenderRanking, defenderWellness, defenderCariche);
  const battleResult = calculateBattle(challengerBattle, defenderBattle);

  const isDraw = battleResult.winnerId === null;
  const challengerWon = battleResult.winnerId === challengerCreature.id;

  // --- Calculate ELO changes ---
  const eloChanges = isDraw
    ? calculateEloChange(challengerRanking.eloRating, defenderRanking.eloRating, true)
    : challengerWon
      ? calculateEloChange(challengerRanking.eloRating, defenderRanking.eloRating, false)
      : calculateEloChange(defenderRanking.eloRating, challengerRanking.eloRating, false);

  let challengerEloDelta: number;
  let defenderEloDelta: number;

  if (isDraw) {
    challengerEloDelta = eloChanges.winnerDelta;
    defenderEloDelta = eloChanges.loserDelta;
  } else if (challengerWon) {
    challengerEloDelta = eloChanges.winnerDelta;
    defenderEloDelta = eloChanges.loserDelta;
  } else {
    challengerEloDelta = eloChanges.loserDelta;
    defenderEloDelta = eloChanges.winnerDelta;
  }

  const challengerEloAfter = challengerRanking.eloRating + challengerEloDelta;
  const defenderEloAfter = defenderRanking.eloRating + defenderEloDelta;

  // --- Save battle record ---
  const [battleRecord] = await db
    .insert(battles)
    .values({
      challengerCreatureId: challengerCreature.id,
      defenderCreatureId: defenderCreature.id,
      challengerUserId,
      defenderUserId,
      battleType: 'ranked',
      winnerCreatureId: battleResult.winnerId,
      roundsPlayed: battleResult.rounds,
      battleLog: battleResult.events,
      challengerEloBefore: challengerRanking.eloRating,
      defenderEloBefore: defenderRanking.eloRating,
      challengerEloAfter,
      defenderEloAfter,
      challengerHpPercent: battleResult.challengerFinalHpPercent,
      defenderHpPercent: battleResult.defenderFinalHpPercent,
    })
    .returning();

  // --- Apply battle consequences ---
  const consequences = applyBattleConsequences(
    challengerWon ? challengerBattle : defenderBattle,
    challengerWon ? defenderBattle : challengerBattle,
    isDraw,
  );

  // Apply combat trait changes on loser creature
  if (!isDraw) {
    const loserId = challengerWon ? defenderCreature.id : challengerCreature.id;
    const loserCreature = challengerWon ? defenderCreature : challengerCreature;
    const loserTraits = loserCreature.traitValues as Record<string, number>;

    const updatedTraits = { ...loserTraits };
    for (const [trait, delta] of Object.entries(consequences.loserChanges.combatTraitLoss)) {
      if (trait in updatedTraits) {
        updatedTraits[trait] = Math.max(0, (updatedTraits[trait] ?? 0) + delta);
      }
    }
    updatedTraits.battleScars = (updatedTraits.battleScars ?? 0) + consequences.loserChanges.newScarCount;

    await db
      .update(creatures)
      .set({ traitValues: updatedTraits as TraitValues, updatedAt: now })
      .where(eq(creatures.id, loserId));

    // Apply winner trait boosts
    const winnerId = challengerWon ? challengerCreature.id : defenderCreature.id;
    const winnerCreature = challengerWon ? challengerCreature : defenderCreature;
    const winnerTraits = { ...(winnerCreature.traitValues as Record<string, number>) };

    for (const [trait, delta] of Object.entries(consequences.winnerChanges.traitBoosts)) {
      if (trait in winnerTraits) {
        winnerTraits[trait] = (winnerTraits[trait] ?? 0) + delta;
      }
    }

    await db
      .update(creatures)
      .set({ traitValues: winnerTraits as TraitValues, updatedAt: now })
      .where(eq(creatures.id, winnerId));
  }

  // --- Calculate AXP awards ---
  let challengerAxpGain = isDraw ? 7 : challengerWon ? 10 : 5;
  let defenderAxpGain = isDraw ? 7 : !challengerWon ? 10 : 5;

  // Console dell'Arena bonus: +5% AXP
  if (challengerCariche.includes('console')) {
    challengerAxpGain = Math.ceil(challengerAxpGain * 1.05);
  }
  if (defenderCariche.includes('console')) {
    defenderAxpGain = Math.ceil(defenderAxpGain * 1.05);
  }
  const challengerAxpAfter = challengerRanking.axp + challengerAxpGain;
  const defenderAxpAfter = defenderRanking.axp + defenderAxpGain;

  // --- Update rankings ---
  const recoveryHours = TIME_CONFIG.isDevMode ? 0.167 : 6;
  const recoveryMs = recoveryHours * 60 * 60 * 1000;

  // Reset battlesToday if new calendar day
  let challengerBattlesToday = challengerRanking.battlesToday;
  if (challengerRanking.lastBattleAt) {
    const lastDate = new Date(challengerRanking.lastBattleAt);
    const isNewDay = lastDate.getUTCDate() !== now.getUTCDate() ||
                     lastDate.getUTCMonth() !== now.getUTCMonth() ||
                     lastDate.getUTCFullYear() !== now.getUTCFullYear();
    if (isNewDay) challengerBattlesToday = 0;
  }

  let defenderBattlesToday = defenderRanking.battlesToday;
  if (defenderRanking.lastBattleAt) {
    const lastDate = new Date(defenderRanking.lastBattleAt);
    const isNewDay = lastDate.getUTCDate() !== now.getUTCDate() ||
                     lastDate.getUTCMonth() !== now.getUTCMonth() ||
                     lastDate.getUTCFullYear() !== now.getUTCFullYear();
    if (isNewDay) defenderBattlesToday = 0;
  }

  // Challenger ranking update
  const challengerNewConsecutiveLosses = challengerWon || isDraw
    ? 0
    : challengerRanking.consecutiveLosses + 1;
  const challengerTraumaActive = challengerTier === 'divine'
    ? false
    : challengerNewConsecutiveLosses >= 5;
  const challengerNewWinStreak = challengerWon
    ? challengerRanking.winStreak + 1
    : 0;

  await db
    .update(creatureRankings)
    .set({
      eloRating: challengerEloAfter,
      eloPeak: Math.max(challengerRanking.eloPeak, challengerEloAfter),
      wins: challengerWon ? challengerRanking.wins + 1 : challengerRanking.wins,
      losses: !challengerWon && !isDraw ? challengerRanking.losses + 1 : challengerRanking.losses,
      draws: isDraw ? challengerRanking.draws + 1 : challengerRanking.draws,
      winStreak: challengerNewWinStreak,
      bestWinStreak: Math.max(challengerRanking.bestWinStreak, challengerNewWinStreak),
      battlesToday: challengerBattlesToday + 1,
      lastBattleAt: now,
      recoveryUntil: !challengerWon && !isDraw ? new Date(now.getTime() + recoveryMs) : null,
      consecutiveLosses: challengerNewConsecutiveLosses,
      traumaActive: challengerTraumaActive,
      axp: challengerAxpAfter,
      rankTier: challengerTier,
      updatedAt: now,
    })
    .where(eq(creatureRankings.creatureId, challengerCreature.id));

  // Defender ranking update
  const defenderWon = !isDraw && !challengerWon;
  const defenderNewConsecutiveLosses = defenderWon || isDraw
    ? 0
    : defenderRanking.consecutiveLosses + 1;
  const defenderTraumaActive = defenderTier === 'divine'
    ? false
    : defenderNewConsecutiveLosses >= 5;
  const defenderNewWinStreak = defenderWon
    ? defenderRanking.winStreak + 1
    : 0;

  await db
    .update(creatureRankings)
    .set({
      eloRating: defenderEloAfter,
      eloPeak: Math.max(defenderRanking.eloPeak, defenderEloAfter),
      wins: defenderWon ? defenderRanking.wins + 1 : defenderRanking.wins,
      losses: !defenderWon && !isDraw ? defenderRanking.losses + 1 : defenderRanking.losses,
      draws: isDraw ? defenderRanking.draws + 1 : defenderRanking.draws,
      winStreak: defenderNewWinStreak,
      bestWinStreak: Math.max(defenderRanking.bestWinStreak, defenderNewWinStreak),
      battlesToday: defenderBattlesToday + 1,
      lastBattleAt: now,
      recoveryUntil: !defenderWon && !isDraw ? new Date(now.getTime() + recoveryMs) : null,
      consecutiveLosses: defenderNewConsecutiveLosses,
      traumaActive: defenderTraumaActive,
      axp: defenderAxpAfter,
      rankTier: defenderTier,
      updatedAt: now,
    })
    .where(eq(creatureRankings.creatureId, defenderCreature.id));

  return {
    battleId: battleRecord.id,
    winnerId: battleResult.winnerId,
    challengerElo: challengerEloAfter,
    defenderElo: defenderEloAfter,
    challengerEloDelta,
    defenderEloDelta,
    challengerName: challengerCreature.name,
    defenderName: defenderCreature.name,
    rounds: battleResult.rounds,
    isDraw,
  };
}
