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

  // -----------------------------------------------------------------------
  // 5. Auto-fill enrollment tournaments with bots as deadline approaches
  // -----------------------------------------------------------------------

  const enrollingTournaments = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.status, 'enrollment'));

  for (const t of enrollingTournaments) {
    if (!t.startsAt) continue;
    const msUntilStart = t.startsAt.getTime() - now.getTime();
    const hoursUntilStart = msUntilStart / (1000 * 60 * 60);
    const maxSlots = t.maxParticipants ?? 16;

    // Count current participants
    const [pCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, t.id));
    const currentCount = pCount?.count ?? 0;
    const emptySlots = maxSlots - currentCount;

    if (emptySlots <= 0) continue;

    // Gradually fill: more aggressive as start approaches
    // > 6h: fill 1 slot per cycle
    // 3-6h: fill 2 slots per cycle
    // 1-3h: fill 3 slots per cycle
    // < 1h: fill ALL remaining slots
    let slotsToFill = 0;
    if (hoursUntilStart <= 0) {
      slotsToFill = emptySlots; // past deadline, fill all
    } else if (hoursUntilStart <= 1) {
      slotsToFill = emptySlots; // last hour, fill all
    } else if (hoursUntilStart <= 3) {
      slotsToFill = Math.min(3, emptySlots);
    } else if (hoursUntilStart <= 6) {
      slotsToFill = Math.min(2, emptySlots);
    } else {
      slotsToFill = Math.min(1, emptySlots);
    }

    if (slotsToFill <= 0) continue;

    // Get enrolled user IDs
    const enrolledRows = await db
      .select({ userId: tournamentParticipants.userId })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, t.id));
    const enrolledUserIds = new Set(enrolledRows.map(r => r.userId));

    // Find bot creatures not enrolled, sorted strongest first
    const { users: usersTable } = await import('@/lib/db/schema');
    const botUsers = await db.select().from(usersTable).where(sql`${usersTable.email} LIKE '%@mutagenix.io'`);
    const botUserIds = new Set(botUsers.map(b => b.id));

    const { creatures: creaturesTable } = await import('@/lib/db/schema');
    const eligibleBots = await db.select().from(creaturesTable).where(
      and(
        eq(creaturesTable.isArchived, false),
        eq(creaturesTable.isDead, false),
        sql`${creaturesTable.ageDays} >= 40`,
      ),
    );

    const sortedEligible = eligibleBots
      .filter(c => botUserIds.has(c.userId) && !enrolledUserIds.has(c.userId))
      .sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0));

    let added = 0;
    for (const creature of sortedEligible) {
      if (added >= slotsToFill) break;
      if (enrolledUserIds.has(creature.userId)) continue;

      try {
        await db.insert(tournamentParticipants).values({
          tournamentId: t.id,
          userId: creature.userId,
          squadSnapshot: { starters: [creature.id], reserves: [] },
        });
        enrolledUserIds.add(creature.userId);
        added++;
        results.push(`Auto-fill: ${creature.name} added to ${t.name}`);
      } catch {
        // duplicate or constraint error, skip
      }
    }

    if (added > 0) {
      results.push(`${t.name}: ${added} bot(s) auto-enrolled (${hoursUntilStart.toFixed(1)}h until start)`);
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    details: results,
  });
}
