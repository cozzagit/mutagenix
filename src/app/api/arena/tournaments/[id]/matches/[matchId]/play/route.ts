import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  tournaments,
  tournamentParticipants,
  tournamentMatches,
  creatures,
  creatureRankings,
  battles,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
  executeSquadBattle,
  type SquadSide,
  type BattleFormat,
} from '@/lib/game-engine/squad-battle-engine';
import {
  selectBestCreatures,
  type RotationCandidate,
} from '@/lib/game-engine/squad-auto-rotate';
import { creatureToBattleCreature } from '@/lib/game-engine/battle-helpers';
import { loadWellnessInput } from '@/lib/game-engine/wellness-loader';
import { calculateWellness } from '@/lib/game-engine/wellness';
import { getCreatureCariche } from '@/lib/game-engine/cariche-loader';
import type { CreatureAncestry } from '@/lib/game-engine/kinship-engine';
import type { Creature } from '@/lib/db/schema/creatures';
import type { BattleCreature } from '@/types/battle';
import {
  CALENDAR_POINTS,
  KNOCKOUT_POINTS,
} from '@/lib/game-engine/tournament-engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AccumulatedDamage = Record<
  string,
  { damageTaken: number; hpPercent: number }
>;

// ---------------------------------------------------------------------------
// POST — Execute a tournament match
// ---------------------------------------------------------------------------

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { id: tournamentId, matchId } = await params;

  // 1. Validate match exists
  const [match] = await db
    .select()
    .from(tournamentMatches)
    .where(
      and(
        eq(tournamentMatches.id, matchId),
        eq(tournamentMatches.tournamentId, tournamentId),
      ),
    );

  if (!match) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Match non trovato.' } },
      { status: 404 },
    );
  }

  if (match.status !== 'pending' && match.status !== 'scheduled') {
    return NextResponse.json(
      {
        error: {
          code: 'MATCH_NOT_PLAYABLE',
          message: 'Questo match è già stato giocato o non è ancora disponibile.',
        },
      },
      { status: 422 },
    );
  }

  // Fetch tournament
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament || tournament.status !== 'active') {
    return NextResponse.json(
      { error: { code: 'TOURNAMENT_NOT_ACTIVE', message: 'Il torneo non è attivo.' } },
      { status: 422 },
    );
  }

  // 2. Load participants
  const [participant1] = await db
    .select()
    .from(tournamentParticipants)
    .where(eq(tournamentParticipants.id, match.participant1Id));

  const [participant2] = await db
    .select()
    .from(tournamentParticipants)
    .where(eq(tournamentParticipants.id, match.participant2Id));

  if (!participant1 || !participant2) {
    return NextResponse.json(
      { error: { code: 'PARTICIPANT_MISSING', message: 'Uno dei partecipanti non esiste più.' } },
      { status: 422 },
    );
  }

  // Verify the requesting user is a participant or admin
  const isParticipant =
    participant1.userId === session.userId ||
    participant2.userId === session.userId;

  // Allow admin or system to play any match
  if (!isParticipant) {
    // Check admin
    const [user] = await db
      .select({ isAdmin: sql<boolean>`is_admin` })
      .from(sql`users`)
      .where(sql`id = ${session.userId}`);

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Non sei un partecipante di questo match.' } },
        { status: 403 },
      );
    }
  }

  const format = (tournament.battleFormat ?? '3v3') as BattleFormat;
  const duelCount = format === '1v1' ? 1 : format === '2v2' ? 2 : 3;
  const now = new Date();

  // 3. Load creatures from squad snapshots
  const snap1 = participant1.squadSnapshot as { creatureIds: string[]; autoRotate: boolean };
  const snap2 = participant2.squadSnapshot as { creatureIds: string[]; autoRotate: boolean };

  const accDamage1 = (participant1.accumulatedDamage ?? {}) as AccumulatedDamage;
  const accDamage2 = (participant2.accumulatedDamage ?? {}) as AccumulatedDamage;

  async function loadCreatures(
    creatureIds: string[],
    autoRotate: boolean,
    userId: string,
    accDamage: AccumulatedDamage,
  ): Promise<Creature[]> {
    // Load snapshot creatures
    const creaturesResult =
      creatureIds.length > 0
        ? await db
            .select()
            .from(creatures)
            .where(
              sql`${creatures.id} IN (${sql.join(creatureIds.map((cid) => sql`${cid}`), sql`, `)})`,
            )
        : [];

    // Filter out dead creatures
    let alive = creaturesResult.filter((c) => !c.isDead && !c.isArchived);

    // Auto-rotate if enabled
    if (autoRotate && alive.length < duelCount) {
      const allUserCreatures = await db
        .select()
        .from(creatures)
        .where(
          and(
            eq(creatures.userId, userId),
            eq(creatures.isDead, false),
            eq(creatures.isArchived, false),
          ),
        );

      const candidates: RotationCandidate[] = await Promise.all(
        allUserCreatures.map(async (c) => {
          const tv = c.traitValues as Record<string, number>;
          const wellnessInput = await loadWellnessInput(c.id);
          const wellness = calculateWellness(wellnessInput);
          const hp = accDamage[c.id]?.hpPercent ?? 100;
          return {
            creatureId: c.id,
            attackPower: tv.attackPower ?? 0,
            defense: tv.defense ?? 0,
            speed: tv.speed ?? 0,
            stamina: tv.stamina ?? 0,
            hpPercent: hp,
            isDead: c.isDead,
            isArchived: c.isArchived,
            wellness,
          };
        }),
      );

      const bestIds = selectBestCreatures(candidates, duelCount);
      const bestCreatures = bestIds
        .map((bid) => allUserCreatures.find((c) => c.id === bid))
        .filter((c): c is Creature => c !== undefined);

      if (bestCreatures.length >= duelCount) {
        alive = bestCreatures;
      }
    }

    return alive.slice(0, duelCount);
  }

  const team1Creatures = await loadCreatures(snap1.creatureIds, snap1.autoRotate, participant1.userId, accDamage1);
  const team2Creatures = await loadCreatures(snap2.creatureIds, snap2.autoRotate, participant2.userId, accDamage2);

  if (team1Creatures.length < duelCount || team2Creatures.length < duelCount) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_ENOUGH_CREATURES',
          message: 'Uno dei partecipanti non ha abbastanza creature per combattere.',
        },
      },
      { status: 422 },
    );
  }

  // 5. Build SquadSide with ancestry and persistent damage
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

  async function buildTournamentSquadSide(
    userId: string,
    sideCreatures: Creature[],
    accDamage: AccumulatedDamage,
  ): Promise<SquadSide> {
    const battleCreatures: BattleCreature[] = await Promise.all(
      sideCreatures.map(async (c) => {
        const wellnessInput = await loadWellnessInput(c.id);
        const wellness = calculateWellness(wellnessInput);
        const caricheIds = await getCreatureCariche(c.id);

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

        const bc = creatureToBattleCreature(c, ranking, wellness, caricheIds);

        // Apply persistent damage: scale stamina by hpPercent
        const hpPercent = accDamage[c.id]?.hpPercent ?? 100;
        const hpFactor = hpPercent / 100;
        return {
          ...bc,
          stamina: bc.stamina * hpFactor,
        };
      }),
    );

    return {
      userId,
      creatures: battleCreatures,
      ancestry,
    };
  }

  const team1 = await buildTournamentSquadSide(participant1.userId, team1Creatures, accDamage1);
  const team2 = await buildTournamentSquadSide(participant2.userId, team2Creatures, accDamage2);

  // 7. Execute the battle
  const seed = `tournament-${tournamentId}-${matchId}-${Date.now()}`;
  const result = executeSquadBattle(team1, team2, format, 'tournament', seed);

  // 8. Determine winner
  const participant1Won = result.winnerUserId === participant1.userId;
  const participant2Won = result.winnerUserId === participant2.userId;
  const isDraw = result.winnerUserId === null;
  const winnerParticipantId = participant1Won
    ? participant1.id
    : participant2Won
    ? participant2.id
    : null;

  // 9. Update accumulated damage for both participants
  const newAccDamage1 = { ...accDamage1 };
  const newAccDamage2 = { ...accDamage2 };

  for (const duel of result.duels) {
    // Participant 1's creature
    const prevHp1 = newAccDamage1[duel.creature1Id]?.hpPercent ?? 100;
    newAccDamage1[duel.creature1Id] = {
      damageTaken:
        (newAccDamage1[duel.creature1Id]?.damageTaken ?? 0) +
        (100 - duel.hpPercent1),
      hpPercent: Math.max(20, prevHp1 * (duel.hpPercent1 / 100)),
    };

    // Participant 2's creature
    const prevHp2 = newAccDamage2[duel.creature2Id]?.hpPercent ?? 100;
    newAccDamage2[duel.creature2Id] = {
      damageTaken:
        (newAccDamage2[duel.creature2Id]?.damageTaken ?? 0) +
        (100 - duel.hpPercent2),
      hpPercent: Math.max(20, prevHp2 * (duel.hpPercent2 / 100)),
    };
  }

  // Points
  const isKnockout = tournament.tournamentType === 'knockout' || tournament.tournamentType === 'random';
  const points1 = isKnockout
    ? (participant1Won ? KNOCKOUT_POINTS.WIN : KNOCKOUT_POINTS.LOSS)
    : (participant1Won ? CALENDAR_POINTS.WIN : isDraw ? CALENDAR_POINTS.DRAW : CALENDAR_POINTS.LOSS);
  const points2 = isKnockout
    ? (participant2Won ? KNOCKOUT_POINTS.WIN : KNOCKOUT_POINTS.LOSS)
    : (participant2Won ? CALENDAR_POINTS.WIN : isDraw ? CALENDAR_POINTS.DRAW : CALENDAR_POINTS.LOSS);

  // 10. Update match record
  await db
    .update(tournamentMatches)
    .set({
      status: 'completed',
      winnerId: winnerParticipantId,
      completedAt: now,
      duelResults: result.duels.map((d, i) => ({
        duelIndex: i,
        creature1Id: d.creature1Id,
        creature2Id: d.creature2Id,
        winnerId: d.winnerId,
        hpPercent1: Math.round(d.hpPercent1 * 10) / 10,
        hpPercent2: Math.round(d.hpPercent2 * 10) / 10,
        rounds: d.battleResult.rounds,
        kinshipMalus: d.kinshipMalus,
      })),
      participant1Damage: newAccDamage1,
      participant2Damage: newAccDamage2,
      kinshipData: result.duels.map((d) => ({
        creature1Id: d.creature1Id,
        creature2Id: d.creature2Id,
        malus: d.kinshipMalus,
        teamBonus1: d.teamBonus1,
        teamBonus2: d.teamBonus2,
      })),
    })
    .where(eq(tournamentMatches.id, matchId));

  // 11. Update participant 1 stats
  await db
    .update(tournamentParticipants)
    .set({
      matchesPlayed: sql`${tournamentParticipants.matchesPlayed} + 1`,
      matchesWon: participant1Won
        ? sql`${tournamentParticipants.matchesWon} + 1`
        : tournamentParticipants.matchesWon,
      matchesLost: participant2Won
        ? sql`${tournamentParticipants.matchesLost} + 1`
        : tournamentParticipants.matchesLost,
      matchesDrawn: isDraw
        ? sql`${tournamentParticipants.matchesDrawn} + 1`
        : tournamentParticipants.matchesDrawn,
      points: sql`${tournamentParticipants.points} + ${points1}`,
      accumulatedDamage: newAccDamage1,
      isEliminated: isKnockout ? !participant1Won : false,
    })
    .where(eq(tournamentParticipants.id, participant1.id));

  // 12. Update participant 2 stats
  await db
    .update(tournamentParticipants)
    .set({
      matchesPlayed: sql`${tournamentParticipants.matchesPlayed} + 1`,
      matchesWon: participant2Won
        ? sql`${tournamentParticipants.matchesWon} + 1`
        : tournamentParticipants.matchesWon,
      matchesLost: participant1Won
        ? sql`${tournamentParticipants.matchesLost} + 1`
        : tournamentParticipants.matchesLost,
      matchesDrawn: isDraw
        ? sql`${tournamentParticipants.matchesDrawn} + 1`
        : tournamentParticipants.matchesDrawn,
      points: sql`${tournamentParticipants.points} + ${points2}`,
      accumulatedDamage: newAccDamage2,
      isEliminated: isKnockout ? !participant2Won : false,
    })
    .where(eq(tournamentParticipants.id, participant2.id));

  // 13. Save individual battle records
  const squadBattleId = crypto.randomUUID();

  for (let i = 0; i < result.duels.length; i++) {
    const duel = result.duels[i];

    await db.insert(battles).values({
      challengerCreatureId: duel.creature1Id,
      defenderCreatureId: duel.creature2Id,
      challengerUserId: participant1.userId,
      defenderUserId: participant2.userId,
      battleType: 'tournament',
      battleMode: 'tournament',
      winnerCreatureId: duel.winnerId,
      roundsPlayed: duel.battleResult.rounds,
      battleLog: duel.battleResult.events,
      squadBattleId,
      duelIndex: i,
      tournamentMatchId: matchId,
      kinshipMalus: duel.kinshipMalus,
      teamBonus: duel.teamBonus1,
      challengerEloBefore: 0,
      defenderEloBefore: 0,
      challengerEloAfter: 0,
      defenderEloAfter: 0,
      challengerHpPercent: duel.hpPercent1,
      defenderHpPercent: duel.hpPercent2,
    });
  }

  // 14. Return result
  return NextResponse.json(
    {
      data: {
        matchId,
        format,
        result: isDraw ? 'draw' : participant1Won ? 'team1_win' : 'team2_win',
        winnerParticipantId,
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
        })),
        participant1Damage: newAccDamage1,
        participant2Damage: newAccDamage2,
      },
    },
    { status: 201 },
  );
}
