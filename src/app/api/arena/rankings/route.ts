import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  creatures,
  creatureRankings,
  cariche as caricheTable,
} from '@/lib/db/schema';
import { users } from '@/lib/db/schema/users';
import { eq, desc, and, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10), 1), 100);
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0);
  const tierFilter = searchParams.get('tier') ?? 'all';

  // Build conditions
  const conditions = [eq(creatures.isArchived, false)];
  if (tierFilter !== 'all') {
    conditions.push(eq(creatureRankings.rankTier, tierFilter));
  }

  const rankings = await db
    .select({
      creatureId: creatureRankings.creatureId,
      creatureName: creatures.name,
      ageDays: creatures.ageDays,
      ownerName: users.displayName,
      ownerId: users.id,
      eloRating: creatureRankings.eloRating,
      wins: creatureRankings.wins,
      losses: creatureRankings.losses,
      draws: creatureRankings.draws,
      winStreak: creatureRankings.winStreak,
      bestWinStreak: creatureRankings.bestWinStreak,
      rankTier: creatureRankings.rankTier,
    })
    .from(creatureRankings)
    .innerJoin(creatures, eq(creatures.id, creatureRankings.creatureId))
    .innerJoin(users, eq(users.id, creatureRankings.userId))
    .where(and(...conditions))
    .orderBy(desc(creatureRankings.eloRating))
    .limit(limit)
    .offset(offset);

  // Batch load cariche for all ranked creatures
  const allCariche = rankings.length > 0
    ? await db.select({
        creatureId: caricheTable.creatureId,
        caricaId: caricheTable.caricaId,
      }).from(caricheTable).where(sql`${caricheTable.expiresAt} > NOW()`)
    : [];

  const caricheMap = new Map<string, string[]>();
  for (const c of allCariche) {
    const existing = caricheMap.get(c.creatureId) ?? [];
    existing.push(c.caricaId);
    caricheMap.set(c.creatureId, existing);
  }

  // Detect bot users
  const allUsersForBotCheck = await db.select({ id: users.id, email: users.email }).from(users);
  const botUserIdSet = new Set<string>();
  for (const u of allUsersForBotCheck) {
    if (u.email?.includes('@mutagenix.io')) botUserIdSet.add(u.id);
  }

  // Add position (offset-based)
  const rankedList = rankings.map((r, i) => ({
    position: offset + i + 1,
    creatureId: r.creatureId,
    name: r.creatureName,
    ownerName: r.ownerName,
    isBot: botUserIdSet.has(r.ownerId),
    ageDays: r.ageDays,
    eloRating: r.eloRating,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    winStreak: r.winStreak,
    bestWinStreak: r.bestWinStreak,
    tier: r.rankTier,
    cariche: caricheMap.get(r.creatureId) ?? [],
  }));

  // Try to get the requesting user's position (if authenticated)
  let myPosition: number | null = null;
  let myCreatureId: string | null = null;

  try {
    const session = await auth();
    if (session?.user?.id) {
      // Find user's creature ranking position
      const [myRanking] = await db
        .select({
          creatureId: creatureRankings.creatureId,
          eloRating: creatureRankings.eloRating,
        })
        .from(creatureRankings)
        .innerJoin(creatures, eq(creatures.id, creatureRankings.creatureId))
        .where(
          and(
            eq(creatureRankings.userId, session.user.id),
            eq(creatures.isArchived, false),
          ),
        );

      if (myRanking) {
        myCreatureId = myRanking.creatureId;

        // Count how many have higher ELO
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(creatureRankings)
          .innerJoin(creatures, eq(creatures.id, creatureRankings.creatureId))
          .where(
            and(
              eq(creatures.isArchived, false),
              sql`${creatureRankings.eloRating} > ${myRanking.eloRating}`,
              ...(tierFilter !== 'all' ? [eq(creatureRankings.rankTier, tierFilter)] : []),
            ),
          );

        myPosition = (countResult?.count ?? 0) + 1;
      }
    }
  } catch {
    // Not authenticated, skip
  }

  // Get total count for pagination
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(creatureRankings)
    .innerJoin(creatures, eq(creatures.id, creatureRankings.creatureId))
    .where(and(...conditions));

  return NextResponse.json({
    data: rankedList,
    meta: {
      total: totalResult?.count ?? 0,
      limit,
      offset,
      tier: tierFilter,
    },
    myPosition: myPosition
      ? {
          position: myPosition,
          creatureId: myCreatureId,
        }
      : null,
  });
}
