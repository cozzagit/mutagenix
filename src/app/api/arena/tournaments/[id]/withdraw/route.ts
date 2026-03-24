import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  tournaments,
  tournamentParticipants,
  users,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// POST — Withdraw from a tournament
// ---------------------------------------------------------------------------

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

  // Only allowed during enrollment
  if (tournament.status !== 'enrollment') {
    return NextResponse.json(
      {
        error: {
          code: 'CANNOT_WITHDRAW',
          message: 'Puoi ritirarti solo durante la fase di iscrizione.',
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
      { error: { code: 'NOT_ENROLLED', message: 'Non sei iscritto a questo torneo.' } },
      { status: 422 },
    );
  }

  // Refund entry fee
  if (tournament.entryFee > 0) {
    await db
      .update(users)
      .set({
        energy: sql`${users.energy} + ${tournament.entryFee}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId));
  }

  // Delete participant record
  await db
    .delete(tournamentParticipants)
    .where(eq(tournamentParticipants.id, participant.id));

  return NextResponse.json({
    data: {
      message: 'Ti sei ritirato dal torneo.',
      refundedEnergy: tournament.entryFee,
    },
  });
}
