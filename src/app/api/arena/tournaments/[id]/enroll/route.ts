import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  tournaments,
  tournamentParticipants,
  creatures,
  squads,
  users,
  creatureRankings,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
  generateKnockoutBracket,
  generateCalendarSchedule,
  calculateKnockoutRounds,
} from '@/lib/game-engine/tournament-engine';
import { tournamentMatches } from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// POST — Enroll in a tournament
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

  // Validate status
  if (tournament.status !== 'enrollment') {
    return NextResponse.json(
      { error: { code: 'NOT_ENROLLMENT', message: 'Le iscrizioni per questo torneo non sono aperte.' } },
      { status: 422 },
    );
  }

  // Check enrollment deadline
  if (tournament.enrollmentEnd && tournament.enrollmentEnd < now) {
    return NextResponse.json(
      { error: { code: 'ENROLLMENT_CLOSED', message: 'Il periodo di iscrizione è terminato.' } },
      { status: 422 },
    );
  }

  // Check this specific creature is not already enrolled
  // (same user CAN enroll multiple different creatures)
  const allMyEntries = await db
    .select({ squadSnapshot: tournamentParticipants.squadSnapshot })
    .from(tournamentParticipants)
    .where(
      and(
        eq(tournamentParticipants.tournamentId, id),
        eq(tournamentParticipants.userId, session.userId),
      ),
    );

  // Extract enrolled creature IDs from snapshots
  const myEnrolledCreatureIds = new Set<string>();
  for (const entry of allMyEntries) {
    const snap = entry.squadSnapshot as { starters?: string[]; creatureIds?: string[] } | null;
    const ids = snap?.starters ?? snap?.creatureIds ?? [];
    for (const cid of ids) myEnrolledCreatureIds.add(cid);
  }

  // Check max participants
  if (tournament.maxParticipants) {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, id));

    if ((countResult?.count ?? 0) >= tournament.maxParticipants) {
      return NextResponse.json(
        { error: { code: 'TOURNAMENT_FULL', message: 'Il torneo ha raggiunto il numero massimo di partecipanti.' } },
        { status: 422 },
      );
    }
  }

  // Get format duel count
  const duelCount = tournament.battleFormat === '1v1' ? 1 : tournament.battleFormat === '2v2' ? 2 : 3;

  // Validate user has enough creatures
  const userCreatures = await db
    .select()
    .from(creatures)
    .where(
      and(
        eq(creatures.userId, session.userId),
        eq(creatures.isDead, false),
        eq(creatures.isArchived, false),
      ),
    );

  const warriorCreatures = userCreatures.filter((c) => (c.ageDays ?? 0) >= 40);

  if (warriorCreatures.length < duelCount) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_ENOUGH_CREATURES',
          message: `Servono almeno ${duelCount} creature guerriero (giorno 40+) per il formato ${tournament.battleFormat}.`,
        },
      },
      { status: 422 },
    );
  }

  // Deduct entry fee
  if (tournament.entryFee > 0) {
    const [user] = await db
      .select({ energy: users.energy })
      .from(users)
      .where(eq(users.id, session.userId));

    if (!user || user.energy < tournament.entryFee) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_ENOUGH_ENERGY',
            message: `Servono ${tournament.entryFee} punti energia per iscriversi. Hai solo ${user?.energy ?? 0}.`,
          },
        },
        { status: 422 },
      );
    }

    await db
      .update(users)
      .set({
        energy: sql`${users.energy} - ${tournament.entryFee}`,
        updatedAt: now,
      })
      .where(eq(users.id, session.userId));
  }

  // Build squad snapshot
  let squadSnapshot: { creatureIds: string[]; autoRotate: boolean };

  if (duelCount === 1) {
    // 1v1: use active creature or first warrior
    const [user] = await db
      .select({ activeCreatureId: users.activeCreatureId })
      .from(users)
      .where(eq(users.id, session.userId));

    const activeId = user?.activeCreatureId;
    // Find a warrior creature not already enrolled in this tournament
    const availableWarriors = warriorCreatures.filter(c => !myEnrolledCreatureIds.has(c.id));
    if (availableWarriors.length === 0) {
      return NextResponse.json(
        { error: { code: 'ALL_ENROLLED', message: 'Tutte le tue creature guerriero sono già iscritte a questo torneo.' } },
        { status: 422 },
      );
    }
    // Prefer active creature if available, otherwise first available
    const activeCreature = activeId ? availableWarriors.find(c => c.id === activeId) : null;
    const selectedCreature = activeCreature ?? availableWarriors[0];

    squadSnapshot = {
      creatureIds: [selectedCreature.id],
      autoRotate: false,
    };
  } else {
    // 2v2/3v3: use squad
    const [squad] = await db.select().from(squads).where(eq(squads.userId, session.userId));

    if (squad) {
      const slotIds = [squad.slot1Id, squad.slot2Id, squad.slot3Id]
        .filter((id): id is string => id !== null)
        .slice(0, duelCount);

      if (slotIds.length < duelCount) {
        return NextResponse.json(
          {
            error: {
              code: 'SQUAD_INCOMPLETE',
              message: `La tua squadra deve avere almeno ${duelCount} titolari per il formato ${tournament.battleFormat}.`,
            },
          },
          { status: 422 },
        );
      }

      squadSnapshot = {
        creatureIds: slotIds,
        autoRotate: squad.autoRotate,
      };
    } else {
      return NextResponse.json(
        {
          error: {
            code: 'NO_SQUAD',
            message: 'Devi creare una squadra prima di iscriverti a tornei 2v2/3v3.',
          },
        },
        { status: 422 },
      );
    }
  }

  // Get ELO for seeding
  const creatureIds = squadSnapshot.creatureIds;
  const rankings = creatureIds.length > 0
    ? await db
        .select({ eloRating: creatureRankings.eloRating })
        .from(creatureRankings)
        .where(
          sql`${creatureRankings.creatureId} IN (${sql.join(creatureIds.map((cid) => sql`${cid}`), sql`, `)})`,
        )
    : [];

  const avgElo = rankings.length > 0
    ? Math.round(rankings.reduce((sum, r) => sum + r.eloRating, 0) / rankings.length)
    : 1000;

  // Create participant
  const [participant] = await db
    .insert(tournamentParticipants)
    .values({
      tournamentId: id,
      userId: session.userId,
      squadSnapshot,
      accumulatedDamage: {},
      seed: avgElo, // Will be recomputed at tournament start
    })
    .returning();

  // Check if we should auto-start
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tournamentParticipants)
    .where(eq(tournamentParticipants.tournamentId, id));

  const currentCount = countResult?.count ?? 0;
  const shouldAutoStart =
    currentCount >= tournament.minParticipants &&
    tournament.maxParticipants !== null &&
    currentCount >= tournament.maxParticipants;

  if (shouldAutoStart) {
    await startTournament(id, tournament.tournamentType);
  }

  return NextResponse.json(
    {
      data: {
        participantId: participant.id,
        tournamentStarted: shouldAutoStart,
      },
    },
    { status: 201 },
  );
}

// ---------------------------------------------------------------------------
// Helper: Start tournament (generate bracket/schedule)
// ---------------------------------------------------------------------------

async function startTournament(tournamentId: string, tournamentType: string) {
  const now = new Date();

  // Get all participants with ELO
  const participants = await db
    .select({
      id: tournamentParticipants.id,
      seed: tournamentParticipants.seed,
    })
    .from(tournamentParticipants)
    .where(eq(tournamentParticipants.tournamentId, tournamentId));

  // Re-seed by ELO (seed field stores ELO at enrollment)
  const seeded = participants
    .sort((a, b) => (b.seed ?? 1000) - (a.seed ?? 1000))
    .map((p, i) => ({ ...p, newSeed: i + 1 }));

  // Update seeds
  for (const p of seeded) {
    await db
      .update(tournamentParticipants)
      .set({ seed: p.newSeed })
      .where(eq(tournamentParticipants.id, p.id));
  }

  if (tournamentType === 'knockout' || tournamentType === 'random') {
    // Generate knockout bracket
    const bracketParticipants = seeded.map((p) => ({
      id: p.id,
      eloRating: p.seed ?? 1000,
    }));

    const matches = generateKnockoutBracket(bracketParticipants);
    const totalRounds = calculateKnockoutRounds(seeded.length);

    // Create match records (skip byes — auto-advance)
    for (const match of matches) {
      if (match.isBye) {
        // BYE: no match needed, the real participant auto-advances
        continue;
      }

      await db.insert(tournamentMatches).values({
        tournamentId,
        roundNumber: match.roundNumber,
        participant1Id: match.participant1Id,
        participant2Id: match.participant2Id,
        status: 'pending',
      });
    }

    await db
      .update(tournaments)
      .set({
        status: 'active',
        currentRound: 1,
        totalRounds,
        startsAt: now,
        updatedAt: now,
      })
      .where(eq(tournaments.id, tournamentId));
  } else if (tournamentType === 'calendar') {
    // Generate round-robin schedule
    const calendarParticipants = seeded.map((p) => ({ id: p.id }));
    const matchesPerDay = Math.max(1, Math.floor(seeded.length / 2));
    const matches = generateCalendarSchedule(calendarParticipants, matchesPerDay);

    const totalRounds = matches.length > 0
      ? Math.max(...matches.map((m) => m.roundNumber))
      : 0;

    for (const match of matches) {
      await db.insert(tournamentMatches).values({
        tournamentId,
        roundNumber: match.roundNumber,
        participant1Id: match.participant1Id,
        participant2Id: match.participant2Id,
        status: 'pending',
      });
    }

    await db
      .update(tournaments)
      .set({
        status: 'active',
        currentRound: 1,
        totalRounds,
        startsAt: now,
        updatedAt: now,
      })
      .where(eq(tournaments.id, tournamentId));
  }
}
