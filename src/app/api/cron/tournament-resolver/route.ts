// ---------------------------------------------------------------------------
// Mutagenix – Tournament Resolver Cron
// ---------------------------------------------------------------------------
// GET /api/cron/tournament-resolver?key=mutagenix-bot-secret-2026
//
// Called every 30 minutes:
// 1. Find tournaments in 'resolving' status
// 2. Calculate final standings
// 3. Run death resolution
// 4. Apply deaths to creatures
// 5. Create tournament_results records
// 6. Transition to 'completed'
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  tournaments,
  tournamentParticipants,
  tournamentResults,
  creatures,
} from '@/lib/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import {
  resolveTournamentDeaths,
  type TournamentStanding,
} from '@/lib/game-engine/death-resolution';
import { calculateStandings } from '@/lib/game-engine/tournament-engine';

const CRON_SECRET = 'mutagenix-bot-secret-2026';

type AccumulatedDamage = Record<
  string,
  { damageTaken: number; hpPercent: number }
>;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('key') !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results: string[] = [];

  // Find tournaments in 'resolving' status
  const resolvingTournaments = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.status, 'resolving'));

  for (const tournament of resolvingTournaments) {
    // Get all participants
    const participants = await db
      .select()
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournament.id));

    if (participants.length === 0) {
      // No participants, just complete
      await db
        .update(tournaments)
        .set({ status: 'completed', updatedAt: now })
        .where(eq(tournaments.id, tournament.id));

      results.push(`${tournament.name}: no participants, completed`);
      continue;
    }

    // Calculate final standings
    const standingsInput = participants.map((p) => {
      const accDamage = (p.accumulatedDamage ?? {}) as AccumulatedDamage;
      const totalDamageTaken = Object.values(accDamage).reduce(
        (sum, d) => sum + d.damageTaken,
        0,
      );

      return {
        id: p.id,
        points: p.points,
        matchesWon: p.matchesWon,
        totalDamageTaken,
      };
    });

    const standings = calculateStandings(standingsInput);

    // Build death resolution input
    // Load creatures for each participant
    const deathStandings: TournamentStanding[] = [];

    for (const standing of standings) {
      const participant = participants.find((p) => p.id === standing.participantId)!;
      const accDamage = (participant.accumulatedDamage ?? {}) as AccumulatedDamage;
      const rawSnap = participant.squadSnapshot as { creatureIds?: string[]; starters?: string[] } | null;
      const snap = { creatureIds: rawSnap?.creatureIds ?? rawSnap?.starters ?? [] };

      // Load creatures from snapshot
      const creatureRows =
        snap.creatureIds.length > 0
          ? await db
              .select({
                id: creatures.id,
                isFounder: creatures.isFounder,
              })
              .from(creatures)
              .where(
                sql`${creatures.id} IN (${sql.join(snap.creatureIds.map((cid) => sql`${cid}`), sql`, `)})`,
              )
          : [];

      const creatureData = creatureRows.map((c) => ({
        id: c.id,
        isFounder: c.isFounder,
        hpPercent: accDamage[c.id]?.hpPercent ?? 100,
      }));

      deathStandings.push({
        participantId: participant.id,
        userId: participant.userId,
        finalRank: standing.rank,
        totalParticipants: participants.length,
        accumulatedDamage: accDamage,
        creatures: creatureData,
      });
    }

    // Run death resolution
    const deathVerdicts = resolveTournamentDeaths(deathStandings);

    // Apply deaths
    const deadCreatureIds: string[] = [];
    for (const verdict of deathVerdicts) {
      await db
        .update(creatures)
        .set({
          isDead: true,
          deathAt: now,
          deathCause: 'tournament_damage',
          updatedAt: now,
        })
        .where(eq(creatures.id, verdict.creatureId));

      deadCreatureIds.push(verdict.creatureId);
    }

    // Create tournament_results records
    for (const standing of standings) {
      const participant = participants.find((p) => p.id === standing.participantId)!;
      const accDamage = (participant.accumulatedDamage ?? {}) as AccumulatedDamage;
      const totalDamageTaken = Object.values(accDamage).reduce(
        (sum, d) => sum + d.damageTaken,
        0,
      );

      const rawSnap = participant.squadSnapshot as { creatureIds?: string[]; starters?: string[] } | null;
      const snap = { creatureIds: rawSnap?.creatureIds ?? rawSnap?.starters ?? [] };
      const deaths = deathVerdicts
        .filter((v) => snap.creatureIds.includes(v.creatureId))
        .map((v) => ({
          creatureId: v.creatureId,
          cause: v.cause,
        }));

      await db.insert(tournamentResults).values({
        tournamentId: tournament.id,
        participantId: standing.participantId,
        finalRank: standing.rank,
        finalPoints: participant.points,
        totalDamageTaken: Math.round(totalDamageTaken * 10) / 10,
        creatureDeaths: deaths,
        prizesAwarded: [],
      });
    }

    // Transition to completed
    await db
      .update(tournaments)
      .set({
        status: 'completed',
        endsAt: now,
        updatedAt: now,
      })
      .where(eq(tournaments.id, tournament.id));

    results.push(
      `${tournament.name}: resolved with ${standings.length} participants, ${deathVerdicts.length} deaths`,
    );
  }

  return NextResponse.json({
    ok: true,
    resolved: results.length,
    details: results,
  });
}
