import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  tournaments,
  tournamentResults,
  tournamentParticipants,
  users,
} from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// GET — Final tournament results
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;

  // Check tournament exists and is completed
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

  if (tournament.status !== 'completed') {
    return NextResponse.json(
      { error: { code: 'NOT_COMPLETED', message: 'Il torneo non è ancora terminato.' } },
      { status: 422 },
    );
  }

  const results = await db
    .select({
      id: tournamentResults.id,
      participantId: tournamentResults.participantId,
      userId: tournamentParticipants.userId,
      displayName: users.displayName,
      finalRank: tournamentResults.finalRank,
      finalPoints: tournamentResults.finalPoints,
      totalDamageTaken: tournamentResults.totalDamageTaken,
      creatureDeaths: tournamentResults.creatureDeaths,
      prizesAwarded: tournamentResults.prizesAwarded,
      createdAt: tournamentResults.createdAt,
    })
    .from(tournamentResults)
    .innerJoin(
      tournamentParticipants,
      eq(tournamentParticipants.id, tournamentResults.participantId),
    )
    .innerJoin(users, eq(users.id, tournamentParticipants.userId))
    .where(eq(tournamentResults.tournamentId, id))
    .orderBy(sql`${tournamentResults.finalRank} ASC`);

  return NextResponse.json({
    data: {
      tournament: {
        id: tournament.id,
        name: tournament.name,
        tournamentType: tournament.tournamentType,
        battleFormat: tournament.battleFormat,
      },
      results,
    },
  });
}
