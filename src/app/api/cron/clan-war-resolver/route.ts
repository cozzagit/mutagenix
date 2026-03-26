// ---------------------------------------------------------------------------
// Mutagenix — Clan War Auto-Resolver Cron
// ---------------------------------------------------------------------------
// GET /api/cron/clan-war-resolver?key=mutagenix-bot-secret-2026
//
// 1. Auto-accept pending wars against bot clans (set roster + create matches)
// 2. Auto-execute all pending matches in active (in_progress) clan wars
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  clanWars,
  clanWarMatches,
  clanMemberships,
  clans,
  creatures,
  users,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { executeBattle } from '@/lib/game-engine/execute-battle';

const CRON_SECRET = 'mutagenix-bot-secret-2026';

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('key') !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: string[] = [];

  // -----------------------------------------------------------------------
  // 1. Auto-accept pending wars against bot clans
  // -----------------------------------------------------------------------

  const pendingWars = await db.select().from(clanWars).where(eq(clanWars.status, 'pending'));

  // Get all bot user IDs
  const botUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.email} LIKE '%@mutagenix.io'`);
  const botUserIds = new Set(botUsers.map((b) => b.id));

  for (const war of pendingWars) {
    // Check if the defender clan is a bot clan (boss is a bot)
    const [defenderBoss] = await db
      .select({ userId: clanMemberships.userId })
      .from(clanMemberships)
      .where(
        and(
          eq(clanMemberships.clanId, war.defenderClanId),
          eq(clanMemberships.role, 'boss'),
        ),
      );

    if (!defenderBoss || !botUserIds.has(defenderBoss.userId)) continue;

    // Bot clan — auto-accept: build roster from clan members
    const defenderMembers = await db
      .select({ creatureId: clanMemberships.creatureId })
      .from(clanMemberships)
      .innerJoin(creatures, eq(creatures.id, clanMemberships.creatureId))
      .where(
        and(
          eq(clanMemberships.clanId, war.defenderClanId),
          eq(creatures.isDead, false),
          eq(creatures.isArchived, false),
        ),
      );

    const defenderRoster = defenderMembers.map((m) => m.creatureId);
    const challengerRoster = (war.challengerRoster as string[]) ?? [];

    // Determine number of matches
    const formatToMatches: Record<string, number> = { bo3: 3, bo5: 5, bo7: 7 };
    const totalMatches = formatToMatches[war.format] ?? 5;

    // Create match pairings
    const matchPairs: Array<{ creature1Id: string; creature2Id: string }> = [];
    for (let i = 0; i < totalMatches; i++) {
      const c1 = challengerRoster[i % challengerRoster.length];
      const c2 = defenderRoster[i % defenderRoster.length];
      if (c1 && c2) {
        matchPairs.push({ creature1Id: c1, creature2Id: c2 });
      }
    }

    if (matchPairs.length === 0) {
      results.push(`War ${war.id}: bot clan has no creatures, skipped`);
      continue;
    }

    // Check if matches already exist (avoid duplicates on re-run)
    const [existingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(clanWarMatches)
      .where(eq(clanWarMatches.clanWarId, war.id));

    if ((existingCount?.count ?? 0) === 0) {
      await db.insert(clanWarMatches).values(
        matchPairs.map((pair, index) => ({
          clanWarId: war.id,
          matchIndex: index,
          creature1Id: pair.creature1Id,
          creature2Id: pair.creature2Id,
          status: 'pending' as const,
        })),
      );
    }

    await db
      .update(clanWars)
      .set({
        status: 'in_progress',
        defenderRoster,
        startedAt: new Date(),
      })
      .where(eq(clanWars.id, war.id));

    results.push(`War ${war.id}: bot clan auto-accepted with ${matchPairs.length} matches`);
  }

  // -----------------------------------------------------------------------
  // 2. Auto-execute pending matches in active wars
  // -----------------------------------------------------------------------

  const activeWars = await db
    .select()
    .from(clanWars)
    .where(eq(clanWars.status, 'in_progress'));

  for (const war of activeWars) {
    // Get next pending match
    const pendingMatches = await db
      .select()
      .from(clanWarMatches)
      .where(
        and(
          eq(clanWarMatches.clanWarId, war.id),
          eq(clanWarMatches.status, 'pending'),
        ),
      )
      .orderBy(sql`${clanWarMatches.matchIndex} ASC`);

    if (pendingMatches.length === 0) continue;

    const challengerRoster = (war.challengerRoster as string[]) ?? [];
    let newChallengerWins = war.challengerWins;
    let newDefenderWins = war.defenderWins;

    const formatToNeeded: Record<string, number> = { bo3: 2, bo5: 3, bo7: 4 };
    const winsNeeded = formatToNeeded[war.format] ?? 3;

    for (const match of pendingMatches) {
      // Stop if war already decided
      if (newChallengerWins >= winsNeeded || newDefenderWins >= winsNeeded) break;

      try {
        const [creature1] = await db.select().from(creatures).where(eq(creatures.id, match.creature1Id));
        const [creature2] = await db.select().from(creatures).where(eq(creatures.id, match.creature2Id));

        if (!creature1 || !creature2) {
          // Auto-forfeit
          const winnerId = creature1 ? creature1.id : creature2?.id ?? null;
          await db
            .update(clanWarMatches)
            .set({ status: 'completed', winnerCreatureId: winnerId, completedAt: new Date() })
            .where(eq(clanWarMatches.id, match.id));

          if (winnerId) {
            if (challengerRoster.includes(winnerId)) newChallengerWins++;
            else newDefenderWins++;
          }
          results.push(`War match ${match.matchIndex}: forfeit (missing creature)`);
          continue;
        }

        // Auto-forfeit dead/archived
        if (creature1.isDead || creature1.isArchived) {
          await db.update(clanWarMatches).set({ status: 'completed', winnerCreatureId: creature2.id, completedAt: new Date() }).where(eq(clanWarMatches.id, match.id));
          if (challengerRoster.includes(creature2.id)) newChallengerWins++; else newDefenderWins++;
          results.push(`War match ${match.matchIndex}: ${creature1.name} dead, ${creature2.name} wins`);
          continue;
        }
        if (creature2.isDead || creature2.isArchived) {
          await db.update(clanWarMatches).set({ status: 'completed', winnerCreatureId: creature1.id, completedAt: new Date() }).where(eq(clanWarMatches.id, match.id));
          if (challengerRoster.includes(creature1.id)) newChallengerWins++; else newDefenderWins++;
          results.push(`War match ${match.matchIndex}: ${creature2.name} dead, ${creature1.name} wins`);
          continue;
        }

        // Execute battle
        const battleResult = await executeBattle(creature1, creature2, creature1.userId, creature2.userId);

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
          .where(eq(clanWarMatches.id, match.id));

        if (battleResult.winnerId) {
          if (challengerRoster.includes(battleResult.winnerId)) newChallengerWins++;
          else newDefenderWins++;
        }

        results.push(
          `War match ${match.matchIndex}: ${creature1.name} vs ${creature2.name} → ${battleResult.winnerId === creature1.id ? creature1.name : creature2.name} wins`,
        );
      } catch (err) {
        results.push(`War match ${match.matchIndex}: ERROR — ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Check if war is decided
    let warCompleted = false;
    let winnerClanId: string | null = null;

    if (newChallengerWins >= winsNeeded) {
      warCompleted = true;
      winnerClanId = war.challengerClanId;
    } else if (newDefenderWins >= winsNeeded) {
      warCompleted = true;
      winnerClanId = war.defenderClanId;
    } else {
      const [remaining] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(clanWarMatches)
        .where(and(eq(clanWarMatches.clanWarId, war.id), eq(clanWarMatches.status, 'pending')));
      if ((remaining?.count ?? 0) === 0) {
        warCompleted = true;
        if (newChallengerWins > newDefenderWins) winnerClanId = war.challengerClanId;
        else if (newDefenderWins > newChallengerWins) winnerClanId = war.defenderClanId;
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

      // Update ELO + prestige
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

      const [challengerClan] = await db.select().from(clans).where(eq(clans.id, war.challengerClanId));
      const [defenderClan] = await db.select().from(clans).where(eq(clans.id, war.defenderClanId));

      if (challengerClan) {
        const u: Record<string, unknown> = { clanElo: challengerEloAfter, clanEloPeak: Math.max(challengerClan.clanEloPeak, challengerEloAfter), updatedAt: new Date() };
        if (winnerClanId === war.challengerClanId) { u.clanWins = challengerClan.clanWins + 1; u.prestige = challengerClan.prestige + war.prestigeStakes; }
        else if (winnerClanId === war.defenderClanId) { u.clanLosses = challengerClan.clanLosses + 1; u.prestige = Math.max(0, challengerClan.prestige - Math.floor(war.prestigeStakes / 2)); }
        await db.update(clans).set(u).where(eq(clans.id, war.challengerClanId));
      }

      if (defenderClan) {
        const u: Record<string, unknown> = { clanElo: defenderEloAfter, clanEloPeak: Math.max(defenderClan.clanEloPeak, defenderEloAfter), updatedAt: new Date() };
        if (winnerClanId === war.defenderClanId) { u.clanWins = defenderClan.clanWins + 1; u.prestige = defenderClan.prestige + war.prestigeStakes; }
        else if (winnerClanId === war.challengerClanId) { u.clanLosses = defenderClan.clanLosses + 1; u.prestige = Math.max(0, defenderClan.prestige - Math.floor(war.prestigeStakes / 2)); }
        await db.update(clans).set(u).where(eq(clans.id, war.defenderClanId));
      }

      results.push(`War completed: ${newChallengerWins}-${newDefenderWins}, winner: ${winnerClanId === war.challengerClanId ? 'challenger' : 'defender'}`);
    }

    await db.update(clanWars).set(warUpdate).where(eq(clanWars.id, war.id));
  }

  return NextResponse.json({ ok: true, processed: results.length, details: results });
}
