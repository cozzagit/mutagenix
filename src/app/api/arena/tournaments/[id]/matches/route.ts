import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { tournamentMatches, tournamentParticipants, users } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// GET — List matches for a tournament
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const roundFilter = searchParams.get('round');

  const conditions = [eq(tournamentMatches.tournamentId, id)];

  if (roundFilter) {
    conditions.push(eq(tournamentMatches.roundNumber, parseInt(roundFilter, 10)));
  }

  const matches = await db
    .select()
    .from(tournamentMatches)
    .where(and(...conditions))
    .orderBy(
      sql`${tournamentMatches.roundNumber} ASC, ${tournamentMatches.createdAt} ASC`,
    );

  // Resolve participant names
  const participantIds = new Set<string>();
  for (const m of matches) {
    participantIds.add(m.participant1Id);
    participantIds.add(m.participant2Id);
    if (m.winnerId) participantIds.add(m.winnerId);
  }

  const participantIdArray = [...participantIds];
  const participantRows =
    participantIdArray.length > 0
      ? await db
          .select({
            id: tournamentParticipants.id,
            userId: tournamentParticipants.userId,
            displayName: users.displayName,
          })
          .from(tournamentParticipants)
          .innerJoin(users, eq(users.id, tournamentParticipants.userId))
          .where(
            sql`${tournamentParticipants.id} IN (${sql.join(participantIdArray.map((pid) => sql`${pid}`), sql`, `)})`,
          )
      : [];

  const nameMap = new Map(
    participantRows.map((p) => [p.id, p.displayName]),
  );

  const data = matches.map((m) => ({
    ...m,
    participant1Name: nameMap.get(m.participant1Id) ?? 'Sconosciuto',
    participant2Name: nameMap.get(m.participant2Id) ?? 'Sconosciuto',
    winnerName: m.winnerId ? (nameMap.get(m.winnerId) ?? null) : null,
  }));

  return NextResponse.json({ data });
}
