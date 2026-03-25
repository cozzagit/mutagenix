import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  clanWars,
  clanWarMatches,
  clanMemberships,
  clans,
  creatures,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { executeBattle } from '@/lib/game-engine/execute-battle';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  _request: Request,
  context: RouteContext,
) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { id: warId } = await context.params;

  // Get the war
  const [war] = await db.select().from(clanWars).where(eq(clanWars.id, warId));
  if (!war) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Guerra non trovata' } },
      { status: 404 },
    );
  }

  if (war.status !== 'in_progress') {
    return NextResponse.json(
      { error: { code: 'WRONG_STATUS', message: 'La guerra non è in corso' } },
      { status: 400 },
    );
  }

  // Verify caller is boss of one of the clans
  const [callerMembership] = await db
    .select()
    .from(clanMemberships)
    .where(
      and(
        eq(clanMemberships.userId, session.userId),
        eq(clanMemberships.role, 'boss'),
        sql`${clanMemberships.clanId} IN (${sql`${war.challengerClanId}::uuid`}, ${sql`${war.defenderClanId}::uuid`})`,
      ),
    );

  if (!callerMembership) {
    return NextResponse.json(
      { error: { code: 'NOT_BOSS', message: 'Solo i Boss possono eseguire i match' } },
      { status: 403 },
    );
  }

  // Find next pending match
  const [nextMatch] = await db
    .select()
    .from(clanWarMatches)
    .where(
      and(
        eq(clanWarMatches.clanWarId, warId),
        eq(clanWarMatches.status, 'pending'),
      ),
    )
    .orderBy(sql`${clanWarMatches.matchIndex} ASC`)
    .limit(1);

  if (!nextMatch) {
    return NextResponse.json(
      { error: { code: 'NO_MATCHES', message: 'Tutti i match sono stati giocati' } },
      { status: 400 },
    );
  }

  // Load both creatures
  const [creature1] = await db.select().from(creatures).where(eq(creatures.id, nextMatch.creature1Id));
  const [creature2] = await db.select().from(creatures).where(eq(creatures.id, nextMatch.creature2Id));

  if (!creature1 || !creature2) {
    // Mark match as completed with no winner if a creature doesn't exist
    await db
      .update(clanWarMatches)
      .set({
        status: 'completed',
        winnerCreatureId: creature1 ? creature1.id : creature2?.id ?? null,
        completedAt: new Date(),
      })
      .where(eq(clanWarMatches.id, nextMatch.id));

    return NextResponse.json({
      data: {
        matchId: nextMatch.id,
        matchIndex: nextMatch.matchIndex,
        error: 'Una delle creature non esiste più',
      },
    });
  }

  // Check if creature is dead or archived — auto-forfeit
  if (creature1.isDead || creature1.isArchived) {
    await db
      .update(clanWarMatches)
      .set({
        status: 'completed',
        winnerCreatureId: creature2.id,
        completedAt: new Date(),
      })
      .where(eq(clanWarMatches.id, nextMatch.id));

    // Update war score
    const isChallenger1 = (war.challengerRoster as string[])?.includes(creature1.id);
    const winsField = isChallenger1 ? 'defenderWins' : 'challengerWins';
    const currentWins = isChallenger1 ? war.defenderWins : war.challengerWins;
    await db
      .update(clanWars)
      .set({ [winsField]: currentWins + 1 })
      .where(eq(clanWars.id, warId));

    return NextResponse.json({
      data: {
        matchId: nextMatch.id,
        matchIndex: nextMatch.matchIndex,
        forfeit: true,
        forfeiter: creature1.name,
        winnerId: creature2.id,
      },
    });
  }

  if (creature2.isDead || creature2.isArchived) {
    await db
      .update(clanWarMatches)
      .set({
        status: 'completed',
        winnerCreatureId: creature1.id,
        completedAt: new Date(),
      })
      .where(eq(clanWarMatches.id, nextMatch.id));

    const isChallenger2 = (war.challengerRoster as string[])?.includes(creature2.id);
    const winsField = isChallenger2 ? 'defenderWins' : 'challengerWins';
    const currentWins = isChallenger2 ? war.defenderWins : war.challengerWins;
    await db
      .update(clanWars)
      .set({ [winsField]: currentWins + 1 })
      .where(eq(clanWars.id, warId));

    return NextResponse.json({
      data: {
        matchId: nextMatch.id,
        matchIndex: nextMatch.matchIndex,
        forfeit: true,
        forfeiter: creature2.name,
        winnerId: creature1.id,
      },
    });
  }

  // Execute the battle
  const battleResult = await executeBattle(
    creature1,
    creature2,
    creature1.userId,
    creature2.userId,
  );

  // Update match record
  await db
    .update(clanWarMatches)
    .set({
      status: 'completed',
      battleId: battleResult.battleId,
      winnerCreatureId: battleResult.winnerId,
      hpPercent1: battleResult.isDraw ? 0 : (battleResult.winnerId === creature1.id ? 100 : 0),
      hpPercent2: battleResult.isDraw ? 0 : (battleResult.winnerId === creature2.id ? 100 : 0),
      completedAt: new Date(),
    })
    .where(eq(clanWarMatches.id, nextMatch.id));

  // Update war win counts
  const challengerRoster = (war.challengerRoster as string[]) ?? [];
  let newChallengerWins = war.challengerWins;
  let newDefenderWins = war.defenderWins;

  if (battleResult.winnerId) {
    if (challengerRoster.includes(battleResult.winnerId)) {
      newChallengerWins += 1;
    } else {
      newDefenderWins += 1;
    }
  }

  // Check if war is decided (majority wins)
  const formatToNeeded: Record<string, number> = { bo3: 2, bo5: 3, bo7: 4 };
  const winsNeeded = formatToNeeded[war.format] ?? 3;

  let warCompleted = false;
  let winnerClanId: string | null = null;

  if (newChallengerWins >= winsNeeded) {
    warCompleted = true;
    winnerClanId = war.challengerClanId;
  } else if (newDefenderWins >= winsNeeded) {
    warCompleted = true;
    winnerClanId = war.defenderClanId;
  } else {
    // Check if all matches played
    const [remainingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(clanWarMatches)
      .where(
        and(
          eq(clanWarMatches.clanWarId, warId),
          eq(clanWarMatches.status, 'pending'),
        ),
      );

    if ((remainingCount?.count ?? 0) === 0) {
      warCompleted = true;
      if (newChallengerWins > newDefenderWins) {
        winnerClanId = war.challengerClanId;
      } else if (newDefenderWins > newChallengerWins) {
        winnerClanId = war.defenderClanId;
      }
      // else draw — winnerClanId stays null
    }
  }

  const warUpdate: Record<string, unknown> = {
    challengerWins: newChallengerWins,
    defenderWins: newDefenderWins,
  };

  if (warCompleted) {
    warUpdate.status = 'completed';
    warUpdate.completedAt = new Date();
    warUpdate.winnerClanId = winnerClanId;

    // Update clan ELO and prestige
    const eloSwing = 25;
    const challengerEloAfter = winnerClanId === war.challengerClanId
      ? war.challengerEloBefore + eloSwing
      : winnerClanId === war.defenderClanId
        ? war.challengerEloBefore - eloSwing
        : war.challengerEloBefore;

    const defenderEloAfter = winnerClanId === war.defenderClanId
      ? war.defenderEloBefore + eloSwing
      : winnerClanId === war.challengerClanId
        ? war.defenderEloBefore - eloSwing
        : war.defenderEloBefore;

    warUpdate.challengerEloAfter = challengerEloAfter;
    warUpdate.defenderEloAfter = defenderEloAfter;

    // Update clans
    const [challengerClan] = await db.select().from(clans).where(eq(clans.id, war.challengerClanId));
    const [defenderClan] = await db.select().from(clans).where(eq(clans.id, war.defenderClanId));

    if (challengerClan) {
      const update: Record<string, unknown> = {
        clanElo: challengerEloAfter,
        clanEloPeak: Math.max(challengerClan.clanEloPeak, challengerEloAfter),
        updatedAt: new Date(),
      };
      if (winnerClanId === war.challengerClanId) {
        update.clanWins = challengerClan.clanWins + 1;
        update.prestige = challengerClan.prestige + war.prestigeStakes;
      } else if (winnerClanId === war.defenderClanId) {
        update.clanLosses = challengerClan.clanLosses + 1;
        update.prestige = Math.max(0, challengerClan.prestige - Math.floor(war.prestigeStakes / 2));
      }
      await db.update(clans).set(update).where(eq(clans.id, war.challengerClanId));
    }

    if (defenderClan) {
      const update: Record<string, unknown> = {
        clanElo: defenderEloAfter,
        clanEloPeak: Math.max(defenderClan.clanEloPeak, defenderEloAfter),
        updatedAt: new Date(),
      };
      if (winnerClanId === war.defenderClanId) {
        update.clanWins = defenderClan.clanWins + 1;
        update.prestige = defenderClan.prestige + war.prestigeStakes;
      } else if (winnerClanId === war.challengerClanId) {
        update.clanLosses = defenderClan.clanLosses + 1;
        update.prestige = Math.max(0, defenderClan.prestige - Math.floor(war.prestigeStakes / 2));
      }
      await db.update(clans).set(update).where(eq(clans.id, war.defenderClanId));
    }
  }

  await db.update(clanWars).set(warUpdate).where(eq(clanWars.id, warId));

  return NextResponse.json({
    data: {
      matchId: nextMatch.id,
      matchIndex: nextMatch.matchIndex,
      battleId: battleResult.battleId,
      winnerId: battleResult.winnerId,
      challengerName: battleResult.challengerName,
      defenderName: battleResult.defenderName,
      rounds: battleResult.rounds,
      isDraw: battleResult.isDraw,
      warCompleted,
      winnerClanId,
      challengerWins: newChallengerWins,
      defenderWins: newDefenderWins,
    },
  });
}
