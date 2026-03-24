// ---------------------------------------------------------------------------
// Mutagenix – Random Tournament Auto-Generation Cron
// ---------------------------------------------------------------------------
// GET /api/cron/random-tournaments?key=mutagenix-bot-secret-2026
//
// Runs every 48 hours. Creates a random knockout tournament and auto-enrolls
// all eligible players if conditions are met.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  tournaments,
  tournamentParticipants,
  creatures,
  squads,
  creatureRankings,
  tournamentMatches,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
  generateKnockoutBracket,
  calculateKnockoutRounds,
} from '@/lib/game-engine/tournament-engine';

const CRON_SECRET = 'mutagenix-bot-secret-2026';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('key') !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // -----------------------------------------------------------------------
  // 1. Check if there's already an active or enrollment random tournament
  // -----------------------------------------------------------------------

  const [existingRandom] = await db
    .select({ id: tournaments.id, status: tournaments.status })
    .from(tournaments)
    .where(
      and(
        eq(tournaments.tournamentType, 'random'),
        sql`${tournaments.status} IN ('enrollment', 'active')`,
      ),
    );

  if (existingRandom) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `Random tournament already exists (${existingRandom.status}): ${existingRandom.id}`,
    });
  }

  // -----------------------------------------------------------------------
  // 2. Count eligible players (users with >= 3 living non-archived creatures
  //    with ageDays >= 40)
  // -----------------------------------------------------------------------

  const eligiblePlayers = await db
    .select({
      userId: creatures.userId,
      warriorCount: sql<number>`count(*)::int`,
    })
    .from(creatures)
    .where(
      and(
        eq(creatures.isDead, false),
        eq(creatures.isArchived, false),
        sql`${creatures.ageDays} >= 40`,
      ),
    )
    .groupBy(creatures.userId)
    .having(sql`count(*) >= 3`);

  if (eligiblePlayers.length < 4) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `Not enough eligible players: ${eligiblePlayers.length} (need 4)`,
    });
  }

  // -----------------------------------------------------------------------
  // 3. Count existing random tournaments to generate incrementing name
  // -----------------------------------------------------------------------

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tournaments)
    .where(eq(tournaments.tournamentType, 'random'));

  const tournamentNumber = (countResult?.count ?? 0) + 1;

  // -----------------------------------------------------------------------
  // 4. Calculate maxParticipants (nearest power of 2, capped at 16)
  // -----------------------------------------------------------------------

  const nearestPow2 = Math.pow(
    2,
    Math.floor(Math.log2(eligiblePlayers.length)),
  );
  const maxParticipants = Math.min(16, nearestPow2);

  // -----------------------------------------------------------------------
  // 5. Create the tournament
  // -----------------------------------------------------------------------

  const enrollmentEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [tournament] = await db
    .insert(tournaments)
    .values({
      name: `Torneo Casuale #${tournamentNumber}`,
      tournamentType: 'random',
      battleFormat: '3v3',
      maxParticipants,
      minParticipants: 4,
      entryFee: 0,
      status: 'enrollment',
      enrollmentStart: now,
      enrollmentEnd,
      startsAt: enrollmentEnd,
      schedule: { roundDurationHours: 6 },
    })
    .returning();

  // -----------------------------------------------------------------------
  // 6. Auto-enroll ALL eligible players
  // -----------------------------------------------------------------------

  const enrolledUserIds: string[] = [];
  const enrollmentErrors: string[] = [];

  for (const player of eligiblePlayers) {
    try {
      // Get user's warrior creatures (ageDays >= 40, alive, not archived)
      const warriorCreatures = await db
        .select()
        .from(creatures)
        .where(
          and(
            eq(creatures.userId, player.userId),
            eq(creatures.isDead, false),
            eq(creatures.isArchived, false),
            sql`${creatures.ageDays} >= 40`,
          ),
        );

      if (warriorCreatures.length < 3) continue;

      // Try to use existing squad, otherwise auto-select best 3
      let creatureIds: string[];

      const [squad] = await db
        .select()
        .from(squads)
        .where(eq(squads.userId, player.userId));

      if (squad) {
        const slotIds = [squad.slot1Id, squad.slot2Id, squad.slot3Id].filter(
          (id): id is string => id !== null,
        );

        // Verify all squad slots are valid warriors
        const validSlots = slotIds.filter((sid) =>
          warriorCreatures.some((wc) => wc.id === sid),
        );

        if (validSlots.length >= 3) {
          creatureIds = validSlots.slice(0, 3);
        } else {
          // Fill from warriors by highest ageDays
          const sorted = [...warriorCreatures].sort(
            (a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0),
          );
          creatureIds = sorted.slice(0, 3).map((c) => c.id);
        }
      } else {
        // No squad — auto-select best 3 warriors by age
        const sorted = [...warriorCreatures].sort(
          (a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0),
        );
        creatureIds = sorted.slice(0, 3).map((c) => c.id);
      }

      // Get average ELO for seeding
      const rankings =
        creatureIds.length > 0
          ? await db
              .select({ eloRating: creatureRankings.eloRating })
              .from(creatureRankings)
              .where(
                sql`${creatureRankings.creatureId} IN (${sql.join(
                  creatureIds.map((cid) => sql`${cid}`),
                  sql`, `,
                )})`,
              )
          : [];

      const avgElo =
        rankings.length > 0
          ? Math.round(
              rankings.reduce((sum, r) => sum + r.eloRating, 0) /
                rankings.length,
            )
          : 1000;

      // Create participant
      await db.insert(tournamentParticipants).values({
        tournamentId: tournament.id,
        userId: player.userId,
        squadSnapshot: {
          creatureIds,
          autoRotate: squad?.autoRotate ?? true,
        },
        accumulatedDamage: {},
        seed: avgElo,
      });

      enrolledUserIds.push(player.userId);
    } catch (err) {
      enrollmentErrors.push(
        `User ${player.userId}: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // 7. If enough participants, generate bracket immediately
  // -----------------------------------------------------------------------

  if (enrolledUserIds.length >= 4) {
    // Re-seed by ELO
    const participants = await db
      .select({
        id: tournamentParticipants.id,
        seed: tournamentParticipants.seed,
      })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournament.id));

    const seeded = participants
      .sort((a, b) => (b.seed ?? 1000) - (a.seed ?? 1000))
      .map((p, i) => ({ ...p, newSeed: i + 1 }));

    for (const p of seeded) {
      await db
        .update(tournamentParticipants)
        .set({ seed: p.newSeed })
        .where(eq(tournamentParticipants.id, p.id));
    }

    // Generate bracket
    const bracketParticipants = seeded.map((p) => ({
      id: p.id,
      eloRating: p.seed ?? 1000,
    }));

    const matches = generateKnockoutBracket(bracketParticipants);
    const totalRounds = calculateKnockoutRounds(seeded.length);

    for (const match of matches) {
      if (match.isBye) continue;

      await db.insert(tournamentMatches).values({
        tournamentId: tournament.id,
        roundNumber: match.roundNumber,
        participant1Id: match.participant1Id,
        participant2Id: match.participant2Id,
        status: 'pending',
      });
    }

    // Activate the tournament
    await db
      .update(tournaments)
      .set({
        status: 'active',
        currentRound: 1,
        totalRounds,
        startsAt: now,
        updatedAt: now,
      })
      .where(eq(tournaments.id, tournament.id));
  }

  return NextResponse.json({
    ok: true,
    tournamentId: tournament.id,
    name: `Torneo Casuale #${tournamentNumber}`,
    eligiblePlayers: eligiblePlayers.length,
    enrolled: enrolledUserIds.length,
    maxParticipants,
    activated: enrolledUserIds.length >= 4,
    errors: enrollmentErrors.length > 0 ? enrollmentErrors : undefined,
  });
}
