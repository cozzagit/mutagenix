// ---------------------------------------------------------------------------
// Mutagenix – Tournament Ready Check
// ---------------------------------------------------------------------------
// POST /api/arena/tournaments/[id]/ready
//
// For live tournaments: marks a participant as "ready" for their current
// match. The tournament-scheduler cron will only auto-execute live matches
// when both participants are ready.
// ---------------------------------------------------------------------------

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
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const now = new Date();

  // Fetch tournament
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, id));

  if (!tournament) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Torneo non trovato.' } },
      { status: 404 },
    );
  }

  // Must be a live tournament
  if (tournament.tournamentType !== 'live') {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_LIVE',
          message: 'Solo i tornei live richiedono la conferma di prontezza.',
        },
      },
      { status: 422 },
    );
  }

  // Must be active
  if (tournament.status !== 'active') {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_ACTIVE',
          message: 'Il torneo non è attualmente attivo.',
        },
      },
      { status: 422 },
    );
  }

  // Find participant
  const [participant] = await db
    .select()
    .from(tournamentParticipants)
    .where(
      and(
        eq(tournamentParticipants.tournamentId, id),
        eq(tournamentParticipants.userId, session.userId),
      ),
    );

  if (!participant) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_ENROLLED',
          message: 'Non sei iscritto a questo torneo.',
        },
      },
      { status: 422 },
    );
  }

  if (participant.isEliminated) {
    return NextResponse.json(
      {
        error: {
          code: 'ELIMINATED',
          message: 'Sei stato eliminato da questo torneo.',
        },
      },
      { status: 422 },
    );
  }

  // Find the participant's pending match in the current round
  const [pendingMatch] = await db
    .select()
    .from(tournamentMatches)
    .where(
      and(
        eq(tournamentMatches.tournamentId, id),
        eq(tournamentMatches.roundNumber, tournament.currentRound),
        eq(tournamentMatches.status, 'pending'),
        sql`(${tournamentMatches.participant1Id} = ${participant.id} OR ${tournamentMatches.participant2Id} = ${participant.id})`,
      ),
    );

  if (!pendingMatch) {
    return NextResponse.json(
      {
        error: {
          code: 'NO_PENDING_MATCH',
          message: 'Non hai un match in attesa in questo round.',
        },
      },
      { status: 422 },
    );
  }

  // Set readiness via accumulatedDamage (storing readyAt timestamp)
  // accumulatedDamage is a JSONB field we can extend with readiness data
  const currentDamage =
    (participant.accumulatedDamage as Record<string, unknown>) ?? {};
  const updatedDamage = {
    ...currentDamage,
    readyAt: now.toISOString(),
    readyForRound: tournament.currentRound,
    readyForMatchId: pendingMatch.id,
  };

  await db
    .update(tournamentParticipants)
    .set({ accumulatedDamage: updatedDamage })
    .where(eq(tournamentParticipants.id, participant.id));

  return NextResponse.json({
    data: {
      message: 'Sei pronto per il combattimento!',
      matchId: pendingMatch.id,
      round: tournament.currentRound,
      readyAt: now.toISOString(),
    },
  });
}
