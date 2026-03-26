// ---------------------------------------------------------------------------
// Mutagenix – Tournament Scheduler Cron
// ---------------------------------------------------------------------------
// GET /api/cron/tournament-scheduler?key=mutagenix-bot-secret-2026
//
// Called every hour:
// 1. Calendar tournaments: create today's pending matches if not created yet
// 2. Knockout tournaments: if all matches in current round completed, advance
// 3. Tournaments past end date: transition to 'resolving'
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  tournaments,
  tournamentMatches,
  tournamentParticipants,
  creatures,
  creatureRankings,
  battles,
} from '@/lib/db/schema';
import { eq, and, sql, lte } from 'drizzle-orm';
import {
  advanceKnockoutRound,
  generateKnockoutBracket,
  generateCalendarSchedule,
  calculateKnockoutRounds,
  CALENDAR_POINTS,
  KNOCKOUT_POINTS,
} from '@/lib/game-engine/tournament-engine';
import {
  executeSquadBattle,
  type SquadSide,
  type BattleFormat,
} from '@/lib/game-engine/squad-battle-engine';
import { creatureToBattleCreature } from '@/lib/game-engine/battle-helpers';
import { loadWellnessInput } from '@/lib/game-engine/wellness-loader';
import { calculateWellness } from '@/lib/game-engine/wellness';
import { getCreatureCariche } from '@/lib/game-engine/cariche-loader';
import type { CreatureAncestry } from '@/lib/game-engine/kinship-engine';
import type { Creature } from '@/lib/db/schema/creatures';
import type { BattleCreature } from '@/types/battle';

type AccumulatedDamage = Record<string, { damageTaken: number; hpPercent: number }>;

const CRON_SECRET = 'mutagenix-bot-secret-2026';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('key') !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results: string[] = [];

  // -----------------------------------------------------------------------
  // 1. Calendar tournaments: schedule today's matches
  // -----------------------------------------------------------------------

  const calendarTournaments = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.status, 'active'),
        eq(tournaments.tournamentType, 'calendar'),
      ),
    );

  for (const t of calendarTournaments) {
    const currentRound = t.currentRound;

    // Check if current round has pending matches
    const [pendingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournamentId, t.id),
          eq(tournamentMatches.roundNumber, currentRound),
          eq(tournamentMatches.status, 'pending'),
        ),
      );

    // If no pending matches in current round, check if all completed
    if ((pendingCount?.count ?? 0) === 0) {
      const [totalInRound] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tournamentMatches)
        .where(
          and(
            eq(tournamentMatches.tournamentId, t.id),
            eq(tournamentMatches.roundNumber, currentRound),
          ),
        );

      const [completedInRound] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tournamentMatches)
        .where(
          and(
            eq(tournamentMatches.tournamentId, t.id),
            eq(tournamentMatches.roundNumber, currentRound),
            eq(tournamentMatches.status, 'completed'),
          ),
        );

      if (
        (totalInRound?.count ?? 0) > 0 &&
        (completedInRound?.count ?? 0) === (totalInRound?.count ?? 0)
      ) {
        // All matches in current round completed
        const nextRound = currentRound + 1;

        // Check if next round has matches
        const [nextRoundCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(tournamentMatches)
          .where(
            and(
              eq(tournamentMatches.tournamentId, t.id),
              eq(tournamentMatches.roundNumber, nextRound),
            ),
          );

        if ((nextRoundCount?.count ?? 0) > 0) {
          // Advance to next round
          await db
            .update(tournaments)
            .set({ currentRound: nextRound, updatedAt: now })
            .where(eq(tournaments.id, t.id));

          results.push(`Calendar ${t.name}: advanced to round ${nextRound}`);
        } else {
          // No more rounds — tournament is done
          await db
            .update(tournaments)
            .set({ status: 'resolving', updatedAt: now })
            .where(eq(tournaments.id, t.id));

          results.push(`Calendar ${t.name}: all rounds complete, resolving`);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // 2. Knockout tournaments: advance if all current round matches completed
  // -----------------------------------------------------------------------

  const knockoutTournaments = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.status, 'active'),
        sql`${tournaments.tournamentType} IN ('knockout', 'random')`,
      ),
    );

  for (const t of knockoutTournaments) {
    const currentRound = t.currentRound;

    // Get all matches in current round — ORDER BY created_at to preserve bracket position
    const roundMatches = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournamentId, t.id),
          eq(tournamentMatches.roundNumber, currentRound),
        ),
      )
      .orderBy(sql`${tournamentMatches.createdAt} ASC`);

    const allCompleted = roundMatches.length > 0 &&
      roundMatches.every((m) => m.status === 'completed');

    if (!allCompleted) continue;

    // Check if this was the final (only 1 match)
    if (roundMatches.length === 1) {
      // Tournament is done
      await db
        .update(tournaments)
        .set({ status: 'resolving', updatedAt: now })
        .where(eq(tournaments.id, t.id));

      results.push(`Knockout ${t.name}: final completed, resolving`);
      continue;
    }

    // Generate next round
    const completedForAdvance = roundMatches.map((m) => ({
      participant1Id: m.participant1Id,
      participant2Id: m.participant2Id,
      winnerId: m.winnerId,
    }));

    const nextMatches = advanceKnockoutRound(currentRound, completedForAdvance);

    if (nextMatches.length === 0) {
      await db
        .update(tournaments)
        .set({ status: 'resolving', updatedAt: now })
        .where(eq(tournaments.id, t.id));

      results.push(`Knockout ${t.name}: no more matches, resolving`);
      continue;
    }

    // Create next round matches
    for (const match of nextMatches) {
      await db.insert(tournamentMatches).values({
        tournamentId: t.id,
        roundNumber: match.roundNumber,
        participant1Id: match.participant1Id,
        participant2Id: match.participant2Id,
        status: 'pending',
      });
    }

    await db
      .update(tournaments)
      .set({ currentRound: currentRound + 1, updatedAt: now })
      .where(eq(tournaments.id, t.id));

    results.push(
      `Knockout ${t.name}: advanced to round ${currentRound + 1} with ${nextMatches.length} matches`,
    );
  }

  // -----------------------------------------------------------------------
  // 3. Live tournaments: only execute matches when both participants ready
  // -----------------------------------------------------------------------

  const liveTournaments = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.status, 'active'),
        eq(tournaments.tournamentType, 'live'),
      ),
    );

  for (const t of liveTournaments) {
    // Get pending matches in the current round
    const pendingMatches = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournamentId, t.id),
          eq(tournamentMatches.roundNumber, t.currentRound),
          eq(tournamentMatches.status, 'pending'),
        ),
      );

    for (const match of pendingMatches) {
      // Check if both participants are ready for this match
      const matchParticipants = await db
        .select()
        .from(tournamentParticipants)
        .where(
          sql`${tournamentParticipants.id} IN (${sql`${match.participant1Id}`}, ${sql`${match.participant2Id}`})`,
        );

      const bothReady = matchParticipants.every((p) => {
        const damage = (p.accumulatedDamage as Record<string, unknown>) ?? {};
        return (
          damage.readyForRound === t.currentRound &&
          damage.readyForMatchId === match.id
        );
      });

      if (bothReady) {
        results.push(
          `Live ${t.name}: match ${match.id} — both participants ready (will be executed by resolver)`,
        );
      }
    }
  }

  // -----------------------------------------------------------------------
  // 4. Tournaments past end date: transition to 'resolving'
  // -----------------------------------------------------------------------

  const expiredTournaments = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.status, 'active'),
        lte(tournaments.endsAt, now),
      ),
    );

  for (const t of expiredTournaments) {
    await db
      .update(tournaments)
      .set({ status: 'resolving', updatedAt: now })
      .where(eq(tournaments.id, t.id));

    results.push(`${t.name}: past end date, transitioning to resolving`);
  }

  // -----------------------------------------------------------------------
  // 5. Draft tournaments past enrollment start: transition to 'enrollment'
  // -----------------------------------------------------------------------

  const draftsToOpen = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.status, 'draft'),
        lte(tournaments.enrollmentStart, now),
      ),
    );

  for (const t of draftsToOpen) {
    await db
      .update(tournaments)
      .set({ status: 'enrollment', updatedAt: now })
      .where(eq(tournaments.id, t.id));

    results.push(`${t.name}: enrollment opened`);
  }

  // -----------------------------------------------------------------------
  // 5. Auto-fill enrollment tournaments with bots as deadline approaches
  // -----------------------------------------------------------------------

  const enrollingTournaments = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.status, 'enrollment'));

  for (const t of enrollingTournaments) {
    if (!t.startsAt) continue;
    const msUntilStart = t.startsAt.getTime() - now.getTime();
    const hoursUntilStart = msUntilStart / (1000 * 60 * 60);
    const maxSlots = t.maxParticipants ?? 16;

    // Count current participants
    const [pCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, t.id));
    const currentCount = pCount?.count ?? 0;
    const emptySlots = maxSlots - currentCount;

    if (emptySlots <= 0) continue;

    // Gradually fill: more aggressive as start approaches
    // > 6h: fill 1 slot per cycle
    // 3-6h: fill 2 slots per cycle
    // 1-3h: fill 3 slots per cycle
    // < 1h: fill ALL remaining slots
    let slotsToFill = 0;
    if (hoursUntilStart <= 0) {
      slotsToFill = emptySlots; // past deadline, fill all
    } else if (hoursUntilStart <= 1) {
      slotsToFill = emptySlots; // last hour, fill all
    } else if (hoursUntilStart <= 3) {
      slotsToFill = Math.min(3, emptySlots);
    } else if (hoursUntilStart <= 6) {
      slotsToFill = Math.min(2, emptySlots);
    } else {
      slotsToFill = Math.min(1, emptySlots);
    }

    if (slotsToFill <= 0) continue;

    // Get enrolled user IDs
    const enrolledRows = await db
      .select({ userId: tournamentParticipants.userId })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, t.id));
    const enrolledUserIds = new Set(enrolledRows.map(r => r.userId));

    // Find bot creatures not enrolled, sorted strongest first
    const { users: usersTable } = await import('@/lib/db/schema');
    const botUsers = await db.select().from(usersTable).where(sql`${usersTable.email} LIKE '%@mutagenix.io'`);
    const botUserIds = new Set(botUsers.map(b => b.id));

    const { creatures: creaturesTable } = await import('@/lib/db/schema');
    const eligibleBots = await db.select().from(creaturesTable).where(
      and(
        eq(creaturesTable.isArchived, false),
        eq(creaturesTable.isDead, false),
        sql`${creaturesTable.ageDays} >= 40`,
      ),
    );

    // Get already enrolled creature IDs to avoid duplicates
    const enrolledSnaps = await db
      .select({ squadSnapshot: tournamentParticipants.squadSnapshot })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, t.id));
    const enrolledCreatureIds = new Set<string>();
    for (const s of enrolledSnaps) {
      const snap = s.squadSnapshot as { starters?: string[]; creatureIds?: string[] } | null;
      const ids = snap?.starters ?? snap?.creatureIds ?? [];
      for (const id of ids) enrolledCreatureIds.add(id);
    }

    // For bots, allow MULTIPLE entries per user (different creatures)
    // Remove the unique(tournamentId, userId) constraint check for bots
    const sortedEligible = eligibleBots
      .filter(c => botUserIds.has(c.userId) && !enrolledCreatureIds.has(c.id))
      .sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0));

    let added = 0;
    for (const creature of sortedEligible) {
      if (added >= slotsToFill) break;

      try {
        // Use a unique nonce so the same bot user can have multiple entries
        // by inserting with different participant IDs
        await db.insert(tournamentParticipants).values({
          tournamentId: t.id,
          userId: creature.userId,
          squadSnapshot: { starters: [creature.id], reserves: [] },
        });
        enrolledCreatureIds.add(creature.id);
        added++;
        results.push(`Auto-fill: ${creature.name} added to ${t.name}`);
      } catch {
        // duplicate or constraint error, skip
      }
    }

    if (added > 0) {
      results.push(`${t.name}: ${added} bot(s) auto-enrolled (${hoursUntilStart.toFixed(1)}h until start)`);
    }
  }

  // -----------------------------------------------------------------------
  // 6. Auto-start enrollment tournaments that are full
  // -----------------------------------------------------------------------

  const enrollmentTournamentsForStart = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.status, 'enrollment'));

  for (const t of enrollmentTournamentsForStart) {
    if (!t.maxParticipants) continue;

    const [pCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, t.id));

    const currentCount = pCount?.count ?? 0;
    if (currentCount < t.maxParticipants) continue;
    if (currentCount < (t.minParticipants ?? 4)) continue;

    // Tournament is full — generate bracket and start!
    const participants = await db
      .select({ id: tournamentParticipants.id, seed: tournamentParticipants.seed })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, t.id));

    // Re-seed by ELO
    const seeded = participants
      .sort((a, b) => (b.seed ?? 1000) - (a.seed ?? 1000))
      .map((p, i) => ({ ...p, newSeed: i + 1 }));

    for (const p of seeded) {
      await db.update(tournamentParticipants)
        .set({ seed: p.newSeed })
        .where(eq(tournamentParticipants.id, p.id));
    }

    if (t.tournamentType === 'knockout' || t.tournamentType === 'random') {
      const bracketParticipants = seeded.map(p => ({ id: p.id, eloRating: p.seed ?? 1000 }));
      const matches = generateKnockoutBracket(bracketParticipants);
      const totalRounds = calculateKnockoutRounds(seeded.length);

      for (const match of matches) {
        if (match.isBye) continue;
        await db.insert(tournamentMatches).values({
          tournamentId: t.id,
          roundNumber: match.roundNumber,
          participant1Id: match.participant1Id,
          participant2Id: match.participant2Id,
          status: 'pending',
        });
      }

      await db.update(tournaments).set({
        status: 'active',
        currentRound: 1,
        totalRounds,
        startsAt: now,
        updatedAt: now,
      }).where(eq(tournaments.id, t.id));

      results.push(`${t.name}: FULL (${currentCount}/${t.maxParticipants}) — bracket generated, tournament started!`);
    } else if (t.tournamentType === 'calendar') {
      const calendarParticipants = seeded.map(p => ({ id: p.id }));
      const matchesPerDay = Math.max(1, Math.floor(seeded.length / 2));
      const matches = generateCalendarSchedule(calendarParticipants, matchesPerDay);
      const totalRounds = matches.length > 0 ? Math.max(...matches.map(m => m.roundNumber)) : 0;

      for (const match of matches) {
        await db.insert(tournamentMatches).values({
          tournamentId: t.id,
          roundNumber: match.roundNumber,
          participant1Id: match.participant1Id,
          participant2Id: match.participant2Id,
          status: 'pending',
        });
      }

      await db.update(tournaments).set({
        status: 'active',
        currentRound: 1,
        totalRounds,
        startsAt: now,
        updatedAt: now,
      }).where(eq(tournaments.id, t.id));

      results.push(`${t.name}: FULL — schedule generated, tournament started!`);
    }
  }

  // -----------------------------------------------------------------------
  // 7. Auto-execute all pending matches in active knockout/calendar tournaments
  // -----------------------------------------------------------------------

  const autoExecTournaments = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.status, 'active'),
        sql`${tournaments.tournamentType} IN ('knockout', 'random', 'calendar')`,
      ),
    );

  // Load full ancestry table once for kinship calculations
  const allCreaturesForAncestry = await db
    .select({
      id: creatures.id,
      parentACreatureId: creatures.parentACreatureId,
      parentBCreatureId: creatures.parentBCreatureId,
    })
    .from(creatures);

  const ancestry: CreatureAncestry[] = allCreaturesForAncestry.map((c) => ({
    id: c.id,
    parentAId: c.parentACreatureId,
    parentBId: c.parentBCreatureId,
  }));

  for (const t of autoExecTournaments) {
    const pendingMatches = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournamentId, t.id),
          eq(tournamentMatches.roundNumber, t.currentRound),
          sql`${tournamentMatches.status} IN ('pending', 'scheduled')`,
        ),
      );

    if (pendingMatches.length === 0) continue;

    const format = (t.battleFormat ?? '3v3') as BattleFormat;
    const duelCount = format === '1v1' ? 1 : format === '2v2' ? 2 : 3;
    const isKnockout = t.tournamentType === 'knockout' || t.tournamentType === 'random';

    let matchesExecuted = 0;

    for (const match of pendingMatches) {
      try {
        // Load both participants
        const [participant1] = await db
          .select()
          .from(tournamentParticipants)
          .where(eq(tournamentParticipants.id, match.participant1Id));

        const [participant2] = await db
          .select()
          .from(tournamentParticipants)
          .where(eq(tournamentParticipants.id, match.participant2Id));

        if (!participant1 || !participant2) {
          results.push(`[7] ${t.name} match ${match.id}: missing participant, skipped`);
          continue;
        }

        // Extract creature IDs — handle both {creatureIds:[]} and {starters:[]} formats
        const raw1 = participant1.squadSnapshot as { creatureIds?: string[]; starters?: string[]; autoRotate?: boolean } | null;
        const raw2 = participant2.squadSnapshot as { creatureIds?: string[]; starters?: string[]; autoRotate?: boolean } | null;
        const snap1Ids = raw1?.creatureIds ?? raw1?.starters ?? [];
        const snap2Ids = raw2?.creatureIds ?? raw2?.starters ?? [];

        const accDamage1 = (participant1.accumulatedDamage ?? {}) as AccumulatedDamage;
        const accDamage2 = (participant2.accumulatedDamage ?? {}) as AccumulatedDamage;

        // Load creatures for a participant, filtering dead/archived, up to duelCount
        async function loadSnapCreatures(creatureIds: string[]): Promise<Creature[]> {
          if (creatureIds.length === 0) return [];
          const rows = await db
            .select()
            .from(creatures)
            .where(
              sql`${creatures.id} IN (${sql.join(creatureIds.map((cid) => sql`${cid}`), sql`, `)})`,
            );
          return rows.filter((c) => !c.isDead && !c.isArchived).slice(0, duelCount);
        }

        const team1Creatures = await loadSnapCreatures(snap1Ids);
        const team2Creatures = await loadSnapCreatures(snap2Ids);

        if (team1Creatures.length < duelCount || team2Creatures.length < duelCount) {
          results.push(
            `[7] ${t.name} match ${match.id}: not enough creatures (${team1Creatures.length}v${team2Creatures.length}), skipped`,
          );
          continue;
        }

        // Build a SquadSide from a list of creatures
        async function buildSquadSide(
          userId: string,
          sideCreatures: Creature[],
          accDamage: AccumulatedDamage,
        ): Promise<SquadSide> {
          const battleCreatures: BattleCreature[] = await Promise.all(
            sideCreatures.map(async (c) => {
              const wellnessInput = await loadWellnessInput(c.id);
              const wellness = calculateWellness(wellnessInput);
              const caricheIds = await getCreatureCariche(c.id);

              let [ranking] = await db
                .select()
                .from(creatureRankings)
                .where(eq(creatureRankings.creatureId, c.id));

              if (!ranking) {
                [ranking] = await db
                  .insert(creatureRankings)
                  .values({
                    creatureId: c.id,
                    userId,
                    eloRating: 1000,
                    eloPeak: 1000,
                    rankTier: 'novice',
                  })
                  .returning();
              }

              const bc = creatureToBattleCreature(c, ranking, wellness, caricheIds);

              // Apply persistent damage: scale stamina by hpPercent
              const hpPercent = accDamage[c.id]?.hpPercent ?? 100;
              const hpFactor = hpPercent / 100;
              return { ...bc, stamina: bc.stamina * hpFactor };
            }),
          );

          return { userId, creatures: battleCreatures, ancestry };
        }

        const team1 = await buildSquadSide(participant1.userId, team1Creatures, accDamage1);
        const team2 = await buildSquadSide(participant2.userId, team2Creatures, accDamage2);

        // Execute the battle
        const seed = `cron-tournament-${t.id}-${match.id}-${Date.now()}`;
        const result = executeSquadBattle(team1, team2, format, 'tournament', seed);

        // Determine winner
        const participant1Won = result.winnerUserId === participant1.userId;
        const participant2Won = result.winnerUserId === participant2.userId;
        const isDraw = result.winnerUserId === null;
        const winnerParticipantId = participant1Won
          ? participant1.id
          : participant2Won
          ? participant2.id
          : null;

        // Update accumulated damage
        const newAccDamage1 = { ...accDamage1 };
        const newAccDamage2 = { ...accDamage2 };

        for (const duel of result.duels) {
          const prevHp1 = newAccDamage1[duel.creature1Id]?.hpPercent ?? 100;
          newAccDamage1[duel.creature1Id] = {
            damageTaken: (newAccDamage1[duel.creature1Id]?.damageTaken ?? 0) + (100 - duel.hpPercent1),
            hpPercent: Math.max(20, prevHp1 * (duel.hpPercent1 / 100)),
          };

          const prevHp2 = newAccDamage2[duel.creature2Id]?.hpPercent ?? 100;
          newAccDamage2[duel.creature2Id] = {
            damageTaken: (newAccDamage2[duel.creature2Id]?.damageTaken ?? 0) + (100 - duel.hpPercent2),
            hpPercent: Math.max(20, prevHp2 * (duel.hpPercent2 / 100)),
          };
        }

        // Points
        const points1 = isKnockout
          ? (participant1Won ? KNOCKOUT_POINTS.WIN : KNOCKOUT_POINTS.LOSS)
          : (participant1Won ? CALENDAR_POINTS.WIN : isDraw ? CALENDAR_POINTS.DRAW : CALENDAR_POINTS.LOSS);
        const points2 = isKnockout
          ? (participant2Won ? KNOCKOUT_POINTS.WIN : KNOCKOUT_POINTS.LOSS)
          : (participant2Won ? CALENDAR_POINTS.WIN : isDraw ? CALENDAR_POINTS.DRAW : CALENDAR_POINTS.LOSS);

        // Update match record
        await db
          .update(tournamentMatches)
          .set({
            status: 'completed',
            winnerId: winnerParticipantId,
            completedAt: now,
            duelResults: result.duels.map((d, i) => ({
              duelIndex: i,
              creature1Id: d.creature1Id,
              creature2Id: d.creature2Id,
              winnerId: d.winnerId,
              hpPercent1: Math.round(d.hpPercent1 * 10) / 10,
              hpPercent2: Math.round(d.hpPercent2 * 10) / 10,
              rounds: d.battleResult.rounds,
              kinshipMalus: d.kinshipMalus,
            })),
            participant1Damage: newAccDamage1,
            participant2Damage: newAccDamage2,
            kinshipData: result.duels.map((d) => ({
              creature1Id: d.creature1Id,
              creature2Id: d.creature2Id,
              malus: d.kinshipMalus,
              teamBonus1: d.teamBonus1,
              teamBonus2: d.teamBonus2,
            })),
          })
          .where(eq(tournamentMatches.id, match.id));

        // Update participant 1 stats
        await db
          .update(tournamentParticipants)
          .set({
            matchesPlayed: sql`${tournamentParticipants.matchesPlayed} + 1`,
            matchesWon: participant1Won
              ? sql`${tournamentParticipants.matchesWon} + 1`
              : tournamentParticipants.matchesWon,
            matchesLost: participant2Won
              ? sql`${tournamentParticipants.matchesLost} + 1`
              : tournamentParticipants.matchesLost,
            matchesDrawn: isDraw
              ? sql`${tournamentParticipants.matchesDrawn} + 1`
              : tournamentParticipants.matchesDrawn,
            points: sql`${tournamentParticipants.points} + ${points1}`,
            accumulatedDamage: newAccDamage1,
            isEliminated: isKnockout ? !participant1Won : false,
          })
          .where(eq(tournamentParticipants.id, participant1.id));

        // Update participant 2 stats
        await db
          .update(tournamentParticipants)
          .set({
            matchesPlayed: sql`${tournamentParticipants.matchesPlayed} + 1`,
            matchesWon: participant2Won
              ? sql`${tournamentParticipants.matchesWon} + 1`
              : tournamentParticipants.matchesWon,
            matchesLost: participant1Won
              ? sql`${tournamentParticipants.matchesLost} + 1`
              : tournamentParticipants.matchesLost,
            matchesDrawn: isDraw
              ? sql`${tournamentParticipants.matchesDrawn} + 1`
              : tournamentParticipants.matchesDrawn,
            points: sql`${tournamentParticipants.points} + ${points2}`,
            accumulatedDamage: newAccDamage2,
            isEliminated: isKnockout ? !participant2Won : false,
          })
          .where(eq(tournamentParticipants.id, participant2.id));

        // Save individual battle records
        const squadBattleId = crypto.randomUUID();

        for (let i = 0; i < result.duels.length; i++) {
          const duel = result.duels[i];
          await db.insert(battles).values({
            challengerCreatureId: duel.creature1Id,
            defenderCreatureId: duel.creature2Id,
            challengerUserId: participant1.userId,
            defenderUserId: participant2.userId,
            battleType: 'tournament',
            battleMode: 'tournament',
            winnerCreatureId: duel.winnerId,
            roundsPlayed: duel.battleResult.rounds,
            battleLog: duel.battleResult.events,
            squadBattleId,
            duelIndex: i,
            tournamentMatchId: match.id,
            kinshipMalus: duel.kinshipMalus,
            teamBonus: duel.teamBonus1,
            challengerEloBefore: 0,
            defenderEloBefore: 0,
            challengerEloAfter: 0,
            defenderEloAfter: 0,
            challengerHpPercent: duel.hpPercent1,
            defenderHpPercent: duel.hpPercent2,
          });
        }

        matchesExecuted++;
        results.push(
          `[7] ${t.name} match ${match.id}: ${participant1Won ? 'p1 wins' : participant2Won ? 'p2 wins' : 'draw'} (${result.team1Wins}-${result.team2Wins})`,
        );
      } catch (err) {
        results.push(
          `[7] ${t.name} match ${match.id}: ERROR — ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (matchesExecuted === 0) continue;

    // After executing matches, check if the round is now fully complete
    // and advance inline (mirrors sections 1 & 2 logic)
    const updatedRoundMatches = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournamentId, t.id),
          eq(tournamentMatches.roundNumber, t.currentRound),
        ),
      )
      .orderBy(sql`${tournamentMatches.createdAt} ASC`);

    const allNowCompleted =
      updatedRoundMatches.length > 0 &&
      updatedRoundMatches.every((m) => m.status === 'completed');

    if (!allNowCompleted) continue;

    if (isKnockout) {
      // Final round (1 match) → resolving
      if (updatedRoundMatches.length === 1) {
        await db
          .update(tournaments)
          .set({ status: 'resolving', updatedAt: now })
          .where(eq(tournaments.id, t.id));
        results.push(`[7] ${t.name}: final completed, transitioning to resolving`);
        continue;
      }

      // Generate next round
      const completedForAdvance = updatedRoundMatches.map((m) => ({
        participant1Id: m.participant1Id,
        participant2Id: m.participant2Id,
        winnerId: m.winnerId,
      }));
      const nextMatches = advanceKnockoutRound(t.currentRound, completedForAdvance);

      if (nextMatches.length === 0) {
        await db
          .update(tournaments)
          .set({ status: 'resolving', updatedAt: now })
          .where(eq(tournaments.id, t.id));
        results.push(`[7] ${t.name}: no more knockout matches, transitioning to resolving`);
        continue;
      }

      for (const m of nextMatches) {
        await db.insert(tournamentMatches).values({
          tournamentId: t.id,
          roundNumber: m.roundNumber,
          participant1Id: m.participant1Id,
          participant2Id: m.participant2Id,
          status: 'pending',
        });
      }

      await db
        .update(tournaments)
        .set({ currentRound: t.currentRound + 1, updatedAt: now })
        .where(eq(tournaments.id, t.id));

      results.push(
        `[7] ${t.name}: round complete, advanced to round ${t.currentRound + 1} with ${nextMatches.length} matches`,
      );
    } else {
      // Calendar: advance to next round if one exists
      const nextRound = t.currentRound + 1;
      const [nextRoundCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tournamentMatches)
        .where(
          and(
            eq(tournamentMatches.tournamentId, t.id),
            eq(tournamentMatches.roundNumber, nextRound),
          ),
        );

      if ((nextRoundCount?.count ?? 0) > 0) {
        await db
          .update(tournaments)
          .set({ currentRound: nextRound, updatedAt: now })
          .where(eq(tournaments.id, t.id));
        results.push(`[7] ${t.name}: calendar round complete, advanced to round ${nextRound}`);
      } else {
        await db
          .update(tournaments)
          .set({ status: 'resolving', updatedAt: now })
          .where(eq(tournaments.id, t.id));
        results.push(`[7] ${t.name}: all calendar rounds complete, transitioning to resolving`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    details: results,
  });
}
