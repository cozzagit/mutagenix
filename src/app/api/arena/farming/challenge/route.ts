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
  squads,
  users,
  type TraitValues,
} from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import {
  executeSquadBattle,
  type SquadSide,
  type BattleFormat,
} from '@/lib/game-engine/squad-battle-engine';
import { selectBestCreatures, type RotationCandidate } from '@/lib/game-engine/squad-auto-rotate';
import { creatureToBattleCreature } from '@/lib/game-engine/battle-helpers';
import { loadWellnessInput } from '@/lib/game-engine/wellness-loader';
import { calculateWellness } from '@/lib/game-engine/wellness';
import { getCreatureCariche } from '@/lib/game-engine/cariche-loader';
import {
  applyBattleConsequences,
} from '@/lib/game-engine/battle-engine';
import { BREEDING_CONFIG } from '@/lib/game-engine/breeding-config';
import { TIME_CONFIG } from '@/lib/game-engine/time-config';
import type { CreatureAncestry } from '@/lib/game-engine/kinship-engine';
import type { Creature } from '@/lib/db/schema/creatures';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FARMING_DAILY_LIMIT = 20;
const FARMING_RECOVERY_HOURS_PROD = 3;
const FARMING_AXP_WIN = 5;
const FARMING_AXP_LOSE = 2;
const FARMING_AXP_DRAW = 3;
const ENERGY_WIN = 5;
const ENERGY_LOSE = 2;

// ---------------------------------------------------------------------------
// POST — Execute a farming battle
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  let body: { opponentUserId?: string; format?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Corpo della richiesta non valido.' } },
      { status: 400 },
    );
  }

  const { opponentUserId } = body;
  const format = (body.format ?? '1v1') as BattleFormat;

  if (!opponentUserId || typeof opponentUserId !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'ID dell\'avversario obbligatorio.' } },
      { status: 400 },
    );
  }

  if (!['1v1', '2v2', '3v3'].includes(format)) {
    return NextResponse.json(
      { error: { code: 'INVALID_FORMAT', message: 'Formato non valido. Usa 1v1, 2v2 o 3v3.' } },
      { status: 400 },
    );
  }

  if (opponentUserId === session.userId) {
    return NextResponse.json(
      { error: { code: 'SELF_BATTLE', message: 'Non puoi combattere contro te stesso.' } },
      { status: 422 },
    );
  }

  const now = new Date();
  const duelCount = format === '1v1' ? 1 : format === '2v2' ? 2 : 3;

  // Check daily farming limit
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const [farmingCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(battles)
    .where(
      and(
        eq(battles.challengerUserId, session.userId),
        eq(battles.battleMode, 'farming'),
        gte(battles.createdAt, todayStart),
      ),
    );

  const farmingToday = farmingCountResult?.count ?? 0;
  if (farmingToday >= FARMING_DAILY_LIMIT) {
    return NextResponse.json(
      {
        error: {
          code: 'DAILY_LIMIT',
          message: `Hai raggiunto il limite di ${FARMING_DAILY_LIMIT} battaglie farming giornaliere.`,
        },
      },
      { status: 422 },
    );
  }

  // ---------------------------------------------------------------------------
  // Gather creatures for both sides
  // ---------------------------------------------------------------------------

  const [challengerUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId));

  const [opponentUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, opponentUserId));

  if (!opponentUser) {
    return NextResponse.json(
      { error: { code: 'OPPONENT_NOT_FOUND', message: 'Avversario non trovato.' } },
      { status: 404 },
    );
  }

  // Helper: get creatures for a side
  async function getCreaturesForSide(
    userId: string,
    activeCreatureId: string | null,
    count: number,
  ): Promise<{ creatures: Creature[]; autoRotate: boolean }> {
    if (count === 1) {
      // 1v1: use active creature
      let creature: Creature | undefined;
      if (activeCreatureId) {
        [creature] = await db.select().from(creatures).where(eq(creatures.id, activeCreatureId));
      }
      if (!creature) {
        [creature] = await db
          .select()
          .from(creatures)
          .where(
            and(
              eq(creatures.userId, userId),
              eq(creatures.isArchived, false),
              eq(creatures.isDead, false),
            ),
          );
      }
      return { creatures: creature ? [creature] : [], autoRotate: false };
    }

    // 2v2 / 3v3: get from squad
    const [squad] = await db.select().from(squads).where(eq(squads.userId, userId));
    if (!squad) {
      return { creatures: [], autoRotate: false };
    }

    const slotIds = [squad.slot1Id, squad.slot2Id, squad.slot3Id]
      .filter((id): id is string => id !== null)
      .slice(0, count);

    if (slotIds.length < count) {
      return { creatures: [], autoRotate: squad.autoRotate };
    }

    const squadCreatures = await db
      .select()
      .from(creatures)
      .where(
        and(
          sql`${creatures.id} IN (${sql.join(slotIds.map((id) => sql`${id}`), sql`, `)})`,
          eq(creatures.isDead, false),
          eq(creatures.isArchived, false),
        ),
      );

    return { creatures: squadCreatures, autoRotate: squad.autoRotate };
  }

  const team1Data = await getCreaturesForSide(
    session.userId,
    challengerUser?.activeCreatureId ?? null,
    duelCount,
  );

  if (team1Data.creatures.length < duelCount) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_ENOUGH_CREATURES',
          message: `Non hai abbastanza creature per il formato ${format}. Servono ${duelCount} creature.`,
        },
      },
      { status: 422 },
    );
  }

  const team2Data = await getCreaturesForSide(
    opponentUserId,
    opponentUser.activeCreatureId,
    duelCount,
  );

  if (team2Data.creatures.length < duelCount) {
    return NextResponse.json(
      {
        error: {
          code: 'OPPONENT_NOT_ENOUGH',
          message: `L'avversario non ha abbastanza creature per il formato ${format}.`,
        },
      },
      { status: 422 },
    );
  }

  // Validate challenger creatures are warrior phase (ageDays >= 40)
  // For 1v1: if active creature isn't warrior, try to find one that is
  if (duelCount === 1 && team1Data.creatures.length === 1 && (team1Data.creatures[0].ageDays ?? 0) < 40) {
    const [warrior] = await db.select().from(creatures).where(
      and(
        eq(creatures.userId, session.userId),
        eq(creatures.isArchived, false),
        eq(creatures.isDead, false),
        sql`${creatures.ageDays} >= 40`,
      ),
    );
    if (warrior) {
      team1Data.creatures = [warrior];
    } else {
      return NextResponse.json(
        { error: { code: 'NOT_WARRIOR', message: 'Nessuna creatura ha raggiunto la fase guerriero (giorno 40).' } },
        { status: 422 },
      );
    }
  } else {
    for (const c of team1Data.creatures) {
      if ((c.ageDays ?? 0) < 40) {
        return NextResponse.json(
          { error: { code: 'NOT_WARRIOR', message: `La creatura "${c.name}" non ha raggiunto la fase guerriero (giorno 40).` } },
          { status: 422 },
        );
      }
    }
  }

  // Check recovery for challenger creatures
  const challengerCreatureIds = team1Data.creatures.map((c) => c.id);
  const challengerRankings = challengerCreatureIds.length > 0
    ? await db
        .select()
        .from(creatureRankings)
        .where(
          sql`${creatureRankings.creatureId} IN (${sql.join(challengerCreatureIds.map((id) => sql`${id}`), sql`, `)})`,
        )
    : [];

  for (const ranking of challengerRankings) {
    if (ranking.recoveryUntil && ranking.recoveryUntil > now) {
      const remainingMs = ranking.recoveryUntil.getTime() - now.getTime();
      const remainingMin = Math.ceil(remainingMs / 60000);
      const crName = team1Data.creatures.find((c) => c.id === ranking.creatureId)?.name ?? 'Sconosciuta';
      return NextResponse.json(
        {
          error: {
            code: 'IN_RECOVERY',
            message: `La creatura "${crName}" è in recupero. Tempo rimanente: ${remainingMin} minuti.`,
          },
        },
        { status: 422 },
      );
    }
  }

  // Auto-rotate if enabled (challenger side)
  let team1Creatures = team1Data.creatures;
  if (team1Data.autoRotate && duelCount > 1) {
    const allUserCreatures = await db
      .select()
      .from(creatures)
      .where(
        and(
          eq(creatures.userId, session.userId),
          eq(creatures.isDead, false),
          eq(creatures.isArchived, false),
        ),
      );

    const candidates: RotationCandidate[] = await Promise.all(
      allUserCreatures.map(async (c) => {
        const tv = c.traitValues as Record<string, number>;
        const wellnessInput = await loadWellnessInput(c.id);
        const wellness = calculateWellness(wellnessInput);
        return {
          creatureId: c.id,
          attackPower: tv.attackPower ?? 0,
          defense: tv.defense ?? 0,
          speed: tv.speed ?? 0,
          stamina: tv.stamina ?? 0,
          hpPercent: 100,
          isDead: c.isDead,
          isArchived: c.isArchived,
          wellness,
        };
      }),
    );

    const bestIds = selectBestCreatures(candidates, duelCount);
    const bestCreatures = bestIds
      .map((id) => allUserCreatures.find((c) => c.id === id))
      .filter((c): c is Creature => c !== undefined);

    if (bestCreatures.length >= duelCount) {
      team1Creatures = bestCreatures;
    }
  }

  // ---------------------------------------------------------------------------
  // Build SquadSide for each team
  // ---------------------------------------------------------------------------

  // Load ALL creatures for ancestry (kinship needs to walk up the tree)
  const allCreaturesForAncestry = await db
    .select({
      id: creatures.id,
      parentACreatureId: creatures.parentACreatureId,
      parentBCreatureId: creatures.parentBCreatureId,
    })
    .from(creatures);

  const ancestry: CreatureAncestry[] = allCreaturesForAncestry.map((c) => ({
    id: c.id,
    parentAId: c.parentACreatureId,
    parentBId: c.parentBCreatureId,
  }));

  async function buildSquadSide(
    userId: string,
    sideCreatures: Creature[],
  ): Promise<SquadSide> {
    const battleCreatures = await Promise.all(
      sideCreatures.map(async (c) => {
        const wellnessInput = await loadWellnessInput(c.id);
        const wellness = calculateWellness(wellnessInput);
        const caricheIds = await getCreatureCariche(c.id);

        // Get or create ranking
        let [ranking] = await db
          .select()
          .from(creatureRankings)
          .where(eq(creatureRankings.creatureId, c.id));

        if (!ranking) {
          [ranking] = await db
            .insert(creatureRankings)
            .values({
              creatureId: c.id,
              userId,
              eloRating: 1000,
              eloPeak: 1000,
              rankTier: 'novice',
            })
            .returning();
        }

        return creatureToBattleCreature(c, ranking, wellness, caricheIds);
      }),
    );

    return {
      userId,
      creatures: battleCreatures,
      ancestry,
    };
  }

  const team1 = await buildSquadSide(session.userId, team1Creatures.slice(0, duelCount));
  const team2 = await buildSquadSide(opponentUserId, team2Data.creatures.slice(0, duelCount));

  // ---------------------------------------------------------------------------
  // Execute the battle
  // ---------------------------------------------------------------------------

  const seed = `farming-${session.userId}-${opponentUserId}-${Date.now()}`;
  const result = executeSquadBattle(team1, team2, format, 'farming', seed);

  // ---------------------------------------------------------------------------
  // Save results
  // ---------------------------------------------------------------------------

  const squadBattleId = crypto.randomUUID();
  const challengerWon = result.winnerUserId === session.userId;
  const isDraw = result.winnerUserId === null;

  // Save each duel as a battle record
  const battleRecords = [];
  for (let i = 0; i < result.duels.length; i++) {
    const duel = result.duels[i];

    const [record] = await db
      .insert(battles)
      .values({
        challengerCreatureId: duel.creature1Id,
        defenderCreatureId: duel.creature2Id,
        challengerUserId: session.userId,
        defenderUserId: opponentUserId,
        battleType: 'ranked', // keep existing field convention
        battleMode: 'farming',
        winnerCreatureId: duel.winnerId,
        roundsPlayed: duel.battleResult.rounds,
        battleLog: duel.battleResult.events,
        squadBattleId,
        duelIndex: i,
        kinshipMalus: duel.kinshipMalus,
        teamBonus: duel.teamBonus1,
        // No ELO changes for farming
        challengerEloBefore: 0,
        defenderEloBefore: 0,
        challengerEloAfter: 0,
        defenderEloAfter: 0,
        challengerHpPercent: duel.hpPercent1,
        defenderHpPercent: duel.hpPercent2,
      })
      .returning();

    battleRecords.push(record);

    // Apply LIGHT consequences per duel
    const duelIsDraw = duel.winnerId === null;
    if (!duelIsDraw) {
      const winnerCreature = duel.winnerId === duel.creature1Id
        ? team1.creatures.find((c) => c.id === duel.creature1Id)!
        : team2.creatures.find((c) => c.id === duel.creature2Id)!;
      const loserCreature = duel.winnerId === duel.creature1Id
        ? team2.creatures.find((c) => c.id === duel.creature2Id)!
        : team1.creatures.find((c) => c.id === duel.creature1Id)!;

      const consequences = applyBattleConsequences(winnerCreature, loserCreature, false);

      // Loser: HALVED trait losses, no scars
      const loserId = duel.winnerId === duel.creature1Id ? duel.creature2Id : duel.creature1Id;
      const loserDbCreature = [...team1Creatures, ...team2Data.creatures].find((c) => c.id === loserId);
      if (loserDbCreature) {
        const loserTraits = { ...(loserDbCreature.traitValues as Record<string, number>) };
        for (const [trait, delta] of Object.entries(consequences.loserChanges.combatTraitLoss)) {
          if (trait in loserTraits) {
            // HALVED losses for farming
            loserTraits[trait] = Math.max(0, (loserTraits[trait] ?? 0) + delta / 2);
          }
        }
        // No scars in farming

        await db
          .update(creatures)
          .set({ traitValues: loserTraits as TraitValues, updatedAt: now })
          .where(eq(creatures.id, loserId));
      }

      // Winner: normal trait boosts
      const winnerId = duel.winnerId!;
      const winnerDbCreature = [...team1Creatures, ...team2Data.creatures].find((c) => c.id === winnerId);
      if (winnerDbCreature) {
        const winnerTraits = { ...(winnerDbCreature.traitValues as Record<string, number>) };
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
    }

    // Update farming stats for each creature in the duel
    const c1Won = duel.winnerId === duel.creature1Id;
    const c2Won = duel.winnerId === duel.creature2Id;

    // Creature 1 farming ranking update
    await db
      .update(creatureRankings)
      .set({
        farmingWins: c1Won ? sql`${creatureRankings.farmingWins} + 1` : creatureRankings.farmingWins,
        farmingLosses: c2Won ? sql`${creatureRankings.farmingLosses} + 1` : creatureRankings.farmingLosses,
        farmingDraws: duelIsDraw ? sql`${creatureRankings.farmingDraws} + 1` : creatureRankings.farmingDraws,
        farmingAxp: sql`${creatureRankings.farmingAxp} + ${c1Won ? FARMING_AXP_WIN : duelIsDraw ? FARMING_AXP_DRAW : FARMING_AXP_LOSE}`,
        lastBattleAt: now,
        // Farming recovery: 3 hours prod, shorter in dev
        recoveryUntil: c2Won
          ? new Date(now.getTime() + (TIME_CONFIG.isDevMode ? 0.083 : FARMING_RECOVERY_HOURS_PROD) * 60 * 60 * 1000)
          : undefined,
        updatedAt: now,
      })
      .where(eq(creatureRankings.creatureId, duel.creature1Id));

    // Creature 2 farming ranking update
    await db
      .update(creatureRankings)
      .set({
        farmingWins: c2Won ? sql`${creatureRankings.farmingWins} + 1` : creatureRankings.farmingWins,
        farmingLosses: c1Won ? sql`${creatureRankings.farmingLosses} + 1` : creatureRankings.farmingLosses,
        farmingDraws: duelIsDraw ? sql`${creatureRankings.farmingDraws} + 1` : creatureRankings.farmingDraws,
        farmingAxp: sql`${creatureRankings.farmingAxp} + ${c2Won ? FARMING_AXP_WIN : duelIsDraw ? FARMING_AXP_DRAW : FARMING_AXP_LOSE}`,
        lastBattleAt: now,
        recoveryUntil: c1Won
          ? new Date(now.getTime() + (TIME_CONFIG.isDevMode ? 0.083 : FARMING_RECOVERY_HOURS_PROD) * 60 * 60 * 1000)
          : undefined,
        updatedAt: now,
      })
      .where(eq(creatureRankings.creatureId, duel.creature2Id));
  }

  // ---------------------------------------------------------------------------
  // Energy rewards
  // ---------------------------------------------------------------------------

  const challengerEnergy = challengerWon ? ENERGY_WIN : isDraw ? 0 : ENERGY_LOSE;
  const opponentEnergy = challengerWon ? ENERGY_LOSE : isDraw ? 0 : ENERGY_WIN;

  if (challengerEnergy > 0) {
    await db
      .update(users)
      .set({
        energy: sql`LEAST(${users.energy} + ${challengerEnergy}, ${BREEDING_CONFIG.MAX_ENERGY})`,
        updatedAt: now,
      })
      .where(eq(users.id, session.userId));
  }

  if (opponentEnergy > 0) {
    await db
      .update(users)
      .set({
        energy: sql`LEAST(${users.energy} + ${opponentEnergy}, ${BREEDING_CONFIG.MAX_ENERGY})`,
        updatedAt: now,
      })
      .where(eq(users.id, opponentUserId));
  }

  // ---------------------------------------------------------------------------
  // Return result
  // ---------------------------------------------------------------------------

  return NextResponse.json(
    {
      data: {
        squadBattleId,
        format,
        result: isDraw ? 'draw' : challengerWon ? 'victory' : 'defeat',
        winnerUserId: result.winnerUserId,
        team1Wins: result.team1Wins,
        team2Wins: result.team2Wins,
        team1TotalHpPercent: Math.round(result.team1TotalHpPercent * 10) / 10,
        team2TotalHpPercent: Math.round(result.team2TotalHpPercent * 10) / 10,
        duels: result.duels.map((duel, i) => ({
          duelIndex: i,
          creature1Id: duel.creature1Id,
          creature2Id: duel.creature2Id,
          winnerId: duel.winnerId,
          rounds: duel.battleResult.rounds,
          hpPercent1: Math.round(duel.hpPercent1 * 10) / 10,
          hpPercent2: Math.round(duel.hpPercent2 * 10) / 10,
          kinshipMalus: duel.kinshipMalus,
          teamBonus1: duel.teamBonus1,
          teamBonus2: duel.teamBonus2,
          events: duel.battleResult.events,
        })),
        energy: {
          challenger: challengerEnergy,
          opponent: opponentEnergy,
        },
        farmingAxp: {
          win: FARMING_AXP_WIN,
          lose: FARMING_AXP_LOSE,
          draw: FARMING_AXP_DRAW,
        },
      },
    },
    { status: 201 },
  );
}
