import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  tournaments,
  tournamentParticipants,
} from '@/lib/db/schema';
import { eq, and, or, sql, inArray } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// GET — List tournaments
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  const typeFilter = searchParams.get('type');

  // Build conditions
  const conditions = [];

  if (statusFilter) {
    const statuses = statusFilter.split(',');
    if (statuses.length === 1) {
      conditions.push(eq(tournaments.status, statuses[0]));
    } else {
      conditions.push(inArray(tournaments.status, statuses));
    }
  } else {
    // Default: show enrollment + active
    conditions.push(
      or(
        eq(tournaments.status, 'enrollment'),
        eq(tournaments.status, 'active'),
      )!,
    );
  }

  if (typeFilter) {
    conditions.push(eq(tournaments.tournamentType, typeFilter));
  }

  const tournamentRows = await db
    .select()
    .from(tournaments)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${tournaments.createdAt} DESC`)
    .limit(50);

  // Get participant counts
  const tournamentIds = tournamentRows.map((t) => t.id);

  const participantCounts =
    tournamentIds.length > 0
      ? await db
          .select({
            tournamentId: tournamentParticipants.tournamentId,
            count: sql<number>`count(*)::int`,
          })
          .from(tournamentParticipants)
          .where(inArray(tournamentParticipants.tournamentId, tournamentIds))
          .groupBy(tournamentParticipants.tournamentId)
      : [];

  const countMap = new Map(
    participantCounts.map((pc) => [pc.tournamentId, pc.count]),
  );

  // Check which tournaments the user is enrolled in
  const userEnrollments =
    tournamentIds.length > 0
      ? await db
          .select({ tournamentId: tournamentParticipants.tournamentId })
          .from(tournamentParticipants)
          .where(
            and(
              inArray(tournamentParticipants.tournamentId, tournamentIds),
              eq(tournamentParticipants.userId, session.userId),
            ),
          )
      : [];

  const enrolledSet = new Set(userEnrollments.map((e) => e.tournamentId));

  const data = tournamentRows.map((t) => ({
    id: t.id,
    name: t.name,
    tournamentType: t.tournamentType,
    status: t.status,
    battleFormat: t.battleFormat,
    maxParticipants: t.maxParticipants,
    minParticipants: t.minParticipants,
    entryFee: t.entryFee,
    currentRound: t.currentRound,
    totalRounds: t.totalRounds,
    participantCount: countMap.get(t.id) ?? 0,
    enrollmentStart: t.enrollmentStart,
    enrollmentEnd: t.enrollmentEnd,
    startsAt: t.startsAt,
    endsAt: t.endsAt,
    isEnrolled: enrolledSet.has(t.id),
    createdAt: t.createdAt,
  }));

  return NextResponse.json({ data });
}

// ---------------------------------------------------------------------------
// POST — Create a tournament (admin only)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  // Check admin
  const [user] = await db
    .select({ isAdmin: sql<boolean>`${sql.raw('is_admin')}` })
    .from(sql`users`)
    .where(sql`id = ${session.userId}`);

  if (!user?.isAdmin) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Solo gli admin possono creare tornei.' } },
      { status: 403 },
    );
  }

  let body: {
    name?: string;
    tournamentType?: string;
    battleFormat?: string;
    maxParticipants?: number;
    minParticipants?: number;
    entryFee?: number;
    schedule?: Record<string, unknown>;
    enrollmentStart?: string;
    enrollmentEnd?: string;
    startsAt?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Corpo della richiesta non valido.' } },
      { status: 400 },
    );
  }

  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Nome del torneo obbligatorio.' } },
      { status: 400 },
    );
  }

  const validTypes = ['calendar', 'knockout', 'random'];
  const tournamentType = body.tournamentType ?? 'knockout';
  if (!validTypes.includes(tournamentType)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Tipo di torneo non valido. Usa: calendar, knockout, random.' } },
      { status: 400 },
    );
  }

  const validFormats = ['1v1', '2v2', '3v3'];
  const battleFormat = body.battleFormat ?? '3v3';
  if (!validFormats.includes(battleFormat)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Formato non valido. Usa: 1v1, 2v2, 3v3.' } },
      { status: 400 },
    );
  }

  const now = new Date();
  const enrollmentStart = body.enrollmentStart ? new Date(body.enrollmentStart) : null;
  const status = enrollmentStart && enrollmentStart > now ? 'draft' : 'enrollment';

  const [tournament] = await db
    .insert(tournaments)
    .values({
      name: body.name,
      tournamentType,
      battleFormat,
      status,
      maxParticipants: body.maxParticipants ?? null,
      minParticipants: body.minParticipants ?? 4,
      entryFee: body.entryFee ?? 0,
      schedule: body.schedule ?? {},
      enrollmentStart: enrollmentStart,
      enrollmentEnd: body.enrollmentEnd ? new Date(body.enrollmentEnd) : null,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      createdBy: session.userId,
    })
    .returning();

  return NextResponse.json({ data: tournament }, { status: 201 });
}
