import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  tournamentParticipants,
  users,
} from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// GET — Tournament standings
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
      accumulatedDamage: tournamentParticipants.accumulatedDamage,
    })
    .from(tournamentParticipants)
    .innerJoin(users, eq(users.id, tournamentParticipants.userId))
    .where(eq(tournamentParticipants.tournamentId, id))
    .orderBy(
      sql`${tournamentParticipants.points} DESC, ${tournamentParticipants.matchesWon} DESC`,
    );

  // Calculate total damage taken per participant
  const standings = participantRows.map((p, index) => {
    const accDamage = (p.accumulatedDamage ?? {}) as Record<
      string,
      { damageTaken: number; hpPercent: number }
    >;

    const totalDamageTaken = Object.values(accDamage).reduce(
      (sum, d) => sum + d.damageTaken,
      0,
    );

    return {
      rank: index + 1,
      participantId: p.id,
      userId: p.userId,
      displayName: p.displayName,
      seed: p.seed,
      matchesPlayed: p.matchesPlayed,
      matchesWon: p.matchesWon,
      matchesLost: p.matchesLost,
      matchesDrawn: p.matchesDrawn,
      points: p.points,
      isEliminated: p.isEliminated,
      totalDamageTaken: Math.round(totalDamageTaken * 10) / 10,
    };
  });

  // Re-sort: points desc, then damage taken asc
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
    return a.totalDamageTaken - b.totalDamageTaken;
  });

  // Re-assign ranks after final sort
  standings.forEach((s, i) => {
    s.rank = i + 1;
  });

  return NextResponse.json({ data: standings });
}
