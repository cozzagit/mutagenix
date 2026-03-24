// ---------------------------------------------------------------------------
// Mutagenix – Tournament Scheduler Cron
// ---------------------------------------------------------------------------
// GET /api/cron/tournament-scheduler?key=mutagenix-bot-secret-2026
//
// Called every hour:
// 1. Calendar tournaments: create today's pending matches if not created yet
// 2. Knockout tournaments: if all matches in current round completed, advance
// 3. Tournaments past end date: transition to 'resolving'
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  tournaments,
  tournamentMatches,
  tournamentParticipants,
} from '@/lib/db/schema';
import { eq, and, sql, lte } from 'drizzle-orm';
import {
  advanceKnockoutRound,
} from '@/lib/game-engine/tournament-engine';

const CRON_SECRET = 'mutagenix-bot-secret-2026';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('key') !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results: string[] = [];

  // -----------------------------------------------------------------------
  // 1. Calendar tournaments: schedule today's matches
  // -----------------------------------------------------------------------

  const calendarTournaments = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.status, 'active'),
        eq(tournaments.tournamentType, 'calendar'),
      ),
    );

  for (const t of calendarTournaments) {
    const currentRound = t.currentRound;

    // Check if current round has pending matches
    const [pendingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournamentId, t.id),
          eq(tournamentMatches.roundNumber, currentRound),
          eq(tournamentMatches.status, 'pending'),
        ),
      );

    // If no pending matches in current round, check if all completed
    if ((pendingCount?.count ?? 0) === 0) {
      const [totalInRound] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tournamentMatches)
        .where(
          and(
            eq(tournamentMatches.tournamentId, t.id),
            eq(tournamentMatches.roundNumber, currentRound),
          ),
        );

      const [completedInRound] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tournamentMatches)
        .where(
          and(
            eq(tournamentMatches.tournamentId, t.id),
            eq(tournamentMatches.roundNumber, currentRound),
            eq(tournamentMatches.status, 'completed'),
          ),
        );

      if (
        (totalInRound?.count ?? 0) > 0 &&
        (completedInRound?.count ?? 0) === (totalInRound?.count ?? 0)
      ) {
        // All matches in current round completed
        const nextRound = currentRound + 1;

        // Check if next round has matches
        const [nextRoundCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(tournamentMatches)
          .where(
            and(
              eq(tournamentMatches.tournamentId, t.id),
              eq(tournamentMatches.roundNumber, nextRound),
            ),
          );

        if ((nextRoundCount?.count ?? 0) > 0) {
          // Advance to next round
          await db
            .update(tournaments)
            .set({ currentRound: nextRound, updatedAt: now })
            .where(eq(tournaments.id, t.id));

          results.push(`Calendar ${t.name}: advanced to round ${nextRound}`);
        } else {
          // No more rounds — tournament is done
          await db
            .update(tournaments)
            .set({ status: 'resolving', updatedAt: now })
            .where(eq(tournaments.id, t.id));

          results.push(`Calendar ${t.name}: all rounds complete, resolving`);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // 2. Knockout tournaments: advance if all current round matches completed
  // -----------------------------------------------------------------------

  const knockoutTournaments = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.status, 'active'),
        sql`${tournaments.tournamentType} IN ('knockout', 'random')`,
      ),
    );

  for (const t of knockoutTournaments) {
    const currentRound = t.currentRound;

    // Get all matches in current round
    const roundMatches = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournamentId, t.id),
          eq(tournamentMatches.roundNumber, currentRound),
        ),
      );

    const allCompleted = roundMatches.length > 0 &&
      roundMatches.every((m) => m.status === 'completed');

    if (!allCompleted) continue;

    // Check if this was the final (only 1 match)
    if (roundMatches.length === 1) {
      // Tournament is done
      await db
        .update(tournaments)
        .set({ status: 'resolving', updatedAt: now })
        .where(eq(tournaments.id, t.id));

      results.push(`Knockout ${t.name}: final completed, resolving`);
      continue;
    }

    // Generate next round
    const completedForAdvance = roundMatches.map((m) => ({
      participant1Id: m.participant1Id,
      participant2Id: m.participant2Id,
      winnerId: m.winnerId,
    }));

    const nextMatches = advanceKnockoutRound(currentRound, completedForAdvance);

    if (nextMatches.length === 0) {
      await db
        .update(tournaments)
        .set({ status: 'resolving', updatedAt: now })
        .where(eq(tournaments.id, t.id));

      results.push(`Knockout ${t.name}: no more matches, resolving`);
      continue;
    }

    // Create next round matches
    for (const match of nextMatches) {
      await db.insert(tournamentMatches).values({
        tournamentId: t.id,
        roundNumber: match.roundNumber,
        participant1Id: match.participant1Id,
        participant2Id: match.participant2Id,
        status: 'pending',
      });
    }

    await db
      .update(tournaments)
      .set({ currentRound: currentRound + 1, updatedAt: now })
      .where(eq(tournaments.id, t.id));

    results.push(
      `Knockout ${t.name}: advanced to round ${currentRound + 1} with ${nextMatches.length} matches`,
    );
  }

  // -----------------------------------------------------------------------
  // 3. Live tournaments: only execute matches when both participants ready
  // -----------------------------------------------------------------------

  const liveTournaments = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.status, 'active'),
        eq(tournaments.tournamentType, 'live'),
      ),
    );

  for (const t of liveTournaments) {
    // Get pending matches in the current round
    const pendingMatches = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournamentId, t.id),
          eq(tournamentMatches.roundNumber, t.currentRound),
          eq(tournamentMatches.status, 'pending'),
        ),
      );

    for (const match of pendingMatches) {
      // Check if both participants are ready for this match
      const matchParticipants = await db
        .select()
        .from(tournamentParticipants)
        .where(
          sql`${tournamentParticipants.id} IN (${sql`${match.participant1Id}`}, ${sql`${match.participant2Id}`})`,
        );

      const bothReady = matchParticipants.every((p) => {
        const damage = (p.accumulatedDamage as Record<string, unknown>) ?? {};
        return (
          damage.readyForRound === t.currentRound &&
          damage.readyForMatchId === match.id
        );
      });

      if (bothReady) {
        results.push(
          `Live ${t.name}: match ${match.id} — both participants ready (will be executed by resolver)`,
        );
      }
    }
  }

  // -----------------------------------------------------------------------
  // 4. Tournaments past end date: transition to 'resolving'
  // -----------------------------------------------------------------------

  const expiredTournaments = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.status, 'active'),
        lte(tournaments.endsAt, now),
      ),
    );

  for (const t of expiredTournaments) {
    await db
      .update(tournaments)
      .set({ status: 'resolving', updatedAt: now })
      .where(eq(tournaments.id, t.id));

    results.push(`${t.name}: past end date, transitioning to resolving`);
  }

  // -----------------------------------------------------------------------
  // 5. Draft tournaments past enrollment start: transition to 'enrollment'
  // -----------------------------------------------------------------------

  const draftsToOpen = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.status, 'draft'),
        lte(tournaments.enrollmentStart, now),
      ),
    );

  for (const t of draftsToOpen) {
    await db
      .update(tournaments)
      .set({ status: 'enrollment', updatedAt: now })
      .where(eq(tournaments.id, t.id));

    results.push(`${t.name}: enrollment opened`);
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    details: results,
  });
}
