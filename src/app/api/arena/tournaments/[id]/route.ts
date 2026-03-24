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
  users,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// GET — Tournament detail
// ---------------------------------------------------------------------------

export async function GET(
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

  // Fetch participants with user display names
  const participantRows = await db
    .select({
      id: tournamentParticipants.id,
      userId: tournamentParticipants.userId,
      displayName: users.displayName,
      seed: tournamentParticipants.seed,
      matchesPlayed: tournamentParticipants.matchesPlayed,
      matchesWon: tournamentParticipants.matchesWon,
      matchesLost: tournamentParticipants.matchesLost,
      matchesDrawn: tournamentParticipants.matchesDrawn,
      points: tournamentParticipants.points,
      isEliminated: tournamentParticipants.isEliminated,
      status: tournamentParticipants.status,
      accumulatedDamage: tournamentParticipants.accumulatedDamage,
      enrolledAt: tournamentParticipants.enrolledAt,
    })
    .from(tournamentParticipants)
    .innerJoin(users, eq(users.id, tournamentParticipants.userId))
    .where(eq(tournamentParticipants.tournamentId, id))
    .orderBy(sql`${tournamentParticipants.seed} ASC NULLS LAST`);

  // Fetch matches
  const matchRows = await db
    .select()
    .from(tournamentMatches)
    .where(eq(tournamentMatches.tournamentId, id))
    .orderBy(
      sql`${tournamentMatches.roundNumber} ASC, ${tournamentMatches.createdAt} ASC`,
    );

  // Check if user is enrolled
  const isEnrolled = participantRows.some((p) => p.userId === session.userId);
  const myParticipant = participantRows.find((p) => p.userId === session.userId);

  return NextResponse.json({
    data: {
      tournament,
      participants: participantRows,
      matches: matchRows,
      isEnrolled,
      myParticipantId: myParticipant?.id ?? null,
    },
  });
}
