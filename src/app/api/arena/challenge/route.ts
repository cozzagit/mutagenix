import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  creatures,
  creatureRankings,
  battles,
  users,
  type TraitValues,
} from '@/lib/db/schema';
import { eq, and, ne, gte, sql } from 'drizzle-orm';
import { creatureToBattleCreature } from '@/lib/game-engine/battle-helpers';
import {
  calculateBattle,
  applyBattleConsequences,
  calculateEloChange,
  getRankTier,
} from '@/lib/game-engine/battle-engine';
import { TIME_CONFIG } from '@/lib/game-engine/time-config';
import type { RankTier } from '@/types/battle';

// ---------------------------------------------------------------------------
// AXP helpers
// ---------------------------------------------------------------------------

/** Calculate how much AXP a creature should lose due to inactivity. */
function calculateAxpDecay(lastBattleAt: Date | null, currentAxp: number): number {
  if (!lastBattleAt || currentAxp <= 0) return 0;
  const daysSince = (Date.now() - lastBattleAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 3) return 0;
  const decayDays = Math.floor(daysSince - 3);
  return Math.min(currentAxp, decayDays * 2); // lose 2 per day, min 0
}

// Adjacent tier map: which tiers can fight each other
const ADJACENT_TIERS: Record<RankTier, RankTier[]> = {
  novice: ['novice', 'intermediate'],
  intermediate: ['novice', 'intermediate', 'veteran'],
  veteran: ['intermediate', 'veteran', 'legend'],
  legend: ['veteran', 'legend', 'immortal'],
  immortal: ['legend', 'immortal', 'divine'],
  divine: ['immortal', 'divine', 'eternal'],
  eternal: ['divine', 'eternal'],
};

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  let body: { defenderCreatureId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Corpo della richiesta non valido.' } },
      { status: 400 },
    );
  }

  const { defenderCreatureId } = body;
  if (!defenderCreatureId || typeof defenderCreatureId !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'ID della creatura avversaria obbligatorio.' } },
      { status: 400 },
    );
  }

  // 1. Get challenger's active creature
  const [challengeUser] = await db.select({ activeCreatureId: users.activeCreatureId })
    .from(users).where(eq(users.id, session.userId));

  const [challengerCreature] = challengeUser?.activeCreatureId
    ? await db.select().from(creatures).where(eq(creatures.id, challengeUser.activeCreatureId))
    : await db.select().from(creatures).where(
        and(eq(creatures.userId, session.userId), eq(creatures.isArchived, false)),
      );

  if (!challengerCreature) {
    return NextResponse.json(
      { error: { code: 'NO_CREATURE', message: 'Non hai una creatura attiva.' } },
      { status: 404 },
    );
  }

  // 2. Validate warrior phase (ageDays >= 40)
  if ((challengerCreature.ageDays ?? 0) < 40) {
    return NextResponse.json(
      { error: { code: 'NOT_WARRIOR', message: 'La tua creatura non ha raggiunto la fase guerriero (giorno 40).' } },
      { status: 422 },
    );
  }

  // 3. Get defender creature
  const [defenderCreature] = await db
    .select()
    .from(creatures)
    .where(
      and(
        eq(creatures.id, defenderCreatureId),
        eq(creatures.isArchived, false),
      ),
    );

  if (!defenderCreature) {
    return NextResponse.json(
      { error: { code: 'DEFENDER_NOT_FOUND', message: 'Creatura avversaria non trovata o archiviata.' } },
      { status: 404 },
    );
  }

  // 4. Can't fight yourself
  if (challengerCreature.id === defenderCreature.id) {
    return NextResponse.json(
      { error: { code: 'SELF_BATTLE', message: 'Non puoi combattere contro te stesso.' } },
      { status: 422 },
    );
  }

  // 5. Get or create rankings for both
  const now = new Date();
  const challengerTier = getRankTier(challengerCreature.ageDays ?? 0);
  const defenderTier = getRankTier(defenderCreature.ageDays ?? 0);

  let [challengerRanking] = await db
    .select()
    .from(creatureRankings)
    .where(eq(creatureRankings.creatureId, challengerCreature.id));

  if (!challengerRanking) {
    [challengerRanking] = await db
      .insert(creatureRankings)
      .values({
        creatureId: challengerCreature.id,
        userId: session.userId,
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
        userId: defenderCreature.userId,
        eloRating: 1000,
        eloPeak: 1000,
        rankTier: defenderTier,
      })
      .returning();
  }

  // 6. Validate challenger not in recovery
  if (challengerRanking.recoveryUntil && challengerRanking.recoveryUntil > now) {
    const remainingMs = challengerRanking.recoveryUntil.getTime() - now.getTime();
    const remainingMin = Math.ceil(remainingMs / 60000);
    return NextResponse.json(
      {
        error: {
          code: 'IN_RECOVERY',
          message: `La tua creatura è in recupero. Tempo rimanente: ${remainingMin} minuti.`,
        },
      },
      { status: 422 },
    );
  }

  // 7. Validate attack limit: 10 ATTACKS per day (receiving battles doesn't count)
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const [attackCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(battles)
    .where(
      and(
        eq(battles.challengerUserId, session.userId),
        eq(battles.battleType, 'ranked'),
        gte(battles.createdAt, todayStart),
      ),
    );

  const attacksToday = attackCountResult?.count ?? 0;

  if (attacksToday >= 10) {
    return NextResponse.json(
      { error: { code: 'DAILY_LIMIT', message: 'Hai raggiunto il limite di 10 attacchi giornalieri. Puoi ancora ricevere sfide.' } },
      { status: 422 },
    );
  }

  // 8. Validate same or adjacent rank tier
  if (!ADJACENT_TIERS[challengerTier].includes(defenderTier as RankTier)) {
    return NextResponse.json(
      {
        error: {
          code: 'TIER_MISMATCH',
          message: `Non puoi sfidare un avversario di rango "${defenderTier}". Il tuo rango "${challengerTier}" può sfidare solo: ${ADJACENT_TIERS[challengerTier].join(', ')}.`,
        },
      },
      { status: 422 },
    );
  }

  // 8.5. Apply AXP decay before battle
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

  // 9. Run battle
  const challengerBattle = creatureToBattleCreature(challengerCreature, challengerRanking);
  const defenderBattle = creatureToBattleCreature(defenderCreature, defenderRanking);
  const battleResult = calculateBattle(challengerBattle, defenderBattle);

  const isDraw = battleResult.winnerId === null;
  const challengerWon = battleResult.winnerId === challengerCreature.id;

  // 10. Calculate ELO changes
  const eloChanges = isDraw
    ? calculateEloChange(challengerRanking.eloRating, defenderRanking.eloRating, true)
    : challengerWon
      ? calculateEloChange(challengerRanking.eloRating, defenderRanking.eloRating, false)
      : calculateEloChange(defenderRanking.eloRating, challengerRanking.eloRating, false);

  // Map ELO deltas to challenger/defender perspective
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

  // 11. Save battle record
  const [battleRecord] = await db
    .insert(battles)
    .values({
      challengerCreatureId: challengerCreature.id,
      defenderCreatureId: defenderCreature.id,
      challengerUserId: session.userId,
      defenderUserId: defenderCreature.userId,
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

  // 12. Apply battle consequences
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
    // Add scar
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

  // 12.5. Calculate AXP awards
  const challengerAxpGain = isDraw ? 7 : challengerWon ? 10 : 5;
  const defenderAxpGain = isDraw ? 7 : !challengerWon ? 10 : 5;
  const challengerAxpAfter = challengerRanking.axp + challengerAxpGain;
  const defenderAxpAfter = defenderRanking.axp + defenderAxpGain;

  // 13. Update rankings
  const recoveryHours = TIME_CONFIG.isDevMode ? 0.167 : 6; // 10 min dev, 6h prod
  const recoveryMs = recoveryHours * 60 * 60 * 1000;

  // Challenger ranking update
  const challengerNewConsecutiveLosses = challengerWon || isDraw
    ? 0
    : challengerRanking.consecutiveLosses + 1;
  // Divinità tier is immune to Trauma
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
      battlesToday: attacksToday + 1,
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
  // Divinità tier is immune to Trauma
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
      lastBattleAt: now,
      recoveryUntil: !defenderWon && !isDraw ? new Date(now.getTime() + recoveryMs) : null,
      consecutiveLosses: defenderNewConsecutiveLosses,
      traumaActive: defenderTraumaActive,
      axp: defenderAxpAfter,
      rankTier: defenderTier,
      updatedAt: now,
    })
    .where(eq(creatureRankings.creatureId, defenderCreature.id));

  // 14. Return result
  return NextResponse.json({
    data: {
      battleId: battleRecord.id,
      result: isDraw
        ? 'draw'
        : challengerWon
          ? 'victory'
          : 'defeat',
      winnerId: battleResult.winnerId,
      rounds: battleResult.rounds,
      challengerHpPercent: Math.round(battleResult.challengerFinalHpPercent * 10) / 10,
      defenderHpPercent: Math.round(battleResult.defenderFinalHpPercent * 10) / 10,
      eloChanges: {
        challenger: {
          before: challengerRanking.eloRating,
          after: challengerEloAfter,
          delta: challengerEloDelta,
        },
        defender: {
          before: defenderRanking.eloRating,
          after: defenderEloAfter,
          delta: defenderEloDelta,
        },
      },
      axpChanges: {
        challenger: {
          before: challengerRanking.axp,
          after: challengerAxpAfter,
          delta: challengerAxpGain,
          decay: challengerAxpDecay,
        },
        defender: {
          before: defenderRanking.axp,
          after: defenderAxpAfter,
          delta: defenderAxpGain,
          decay: defenderAxpDecay,
        },
      },
      events: battleResult.events,
      mvpAction: battleResult.mvpAction,
      consequences: isDraw
        ? null
        : {
            winner: consequences.winnerChanges,
            loser: {
              combatTraitLoss: consequences.loserChanges.combatTraitLoss,
              newScars: consequences.loserChanges.newScarCount,
              recoveryHours: consequences.loserChanges.recoveryHours,
            },
          },
    },
  }, { status: 201 });
}
