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
  creatures,
} from '@/lib/db/schema';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import type { TraitValues, ElementLevels } from '@/types/game';
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
      squadSnapshot: tournamentParticipants.squadSnapshot,
    })
    .from(tournamentParticipants)
    .innerJoin(users, eq(users.id, tournamentParticipants.userId))
    .where(eq(tournamentParticipants.tournamentId, id))
    .orderBy(sql`${tournamentParticipants.seed} ASC NULLS LAST`);

  // Fetch creature names for participants' squads
  const creatureIds = new Set<string>();
  for (const p of participantRows) {
    const snap = p.squadSnapshot as { starters?: string[]; creatureIds?: string[] } | null;
    const ids = snap?.starters ?? snap?.creatureIds ?? [];
    for (const cid of ids) creatureIds.add(cid);
  }

  const creatureDataMap = new Map<string, { name: string; ageDays: number; visualParams: Record<string, unknown> }>();
  if (creatureIds.size > 0) {
    const creatureRows = await db
      .select()
      .from(creatures)
      .where(sql`${creatures.id} IN (${sql.join([...creatureIds].map(cid => sql`${cid}`), sql`, `)})`);
    for (const c of creatureRows) {
      const vp = mapTraitsToVisuals(
        c.traitValues as unknown as TraitValues,
        c.elementLevels as unknown as ElementLevels,
        [], c.foundingElements, c.growthElements,
      );
      creatureDataMap.set(c.id, {
        name: c.name,
        ageDays: c.ageDays ?? 0,
        visualParams: vp as unknown as Record<string, unknown>,
      });
    }
  }

  // Add creature data to each participant
  const participantsWithCreature = participantRows.map(p => {
    const snap = p.squadSnapshot as { starters?: string[]; creatureIds?: string[] } | null;
    const creatureId = (snap?.starters ?? snap?.creatureIds)?.[0];
    const cd = creatureId ? creatureDataMap.get(creatureId) : null;
    return {
      ...p,
      creatureName: cd?.name ?? null,
      creatureAgeDays: cd?.ageDays ?? null,
      creatureVisualParams: cd?.visualParams ?? null,
    };
  });

  // Fetch matches
  const matchRows = await db
    .select()
    .from(tournamentMatches)
    .where(eq(tournamentMatches.tournamentId, id))
    .orderBy(
      sql`${tournamentMatches.roundNumber} ASC, ${tournamentMatches.createdAt} ASC`,
    );

  // Check if user is enrolled + collect enrolled creature IDs
  const myEntries = participantRows.filter((p) => p.userId === session.userId);
  const isEnrolled = myEntries.length > 0;
  const myParticipant = myEntries[0];

  const myEnrolledCreatureIds: string[] = [];
  for (const entry of myEntries) {
    const snap = entry.squadSnapshot as { starters?: string[]; creatureIds?: string[] } | null;
    const ids = snap?.starters ?? snap?.creatureIds ?? [];
    myEnrolledCreatureIds.push(...ids);
  }

  return NextResponse.json({
    data: {
      tournament,
      participants: participantsWithCreature,
      matches: matchRows,
      isEnrolled,
      myParticipantId: myParticipant?.id ?? null,
      myEnrolledCreatureIds,
    },
  });
}
