import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { battles, creatures } from '@/lib/db/schema';
import { eq, or, and, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '10', 10), 1), 50);
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0);
  const mode = searchParams.get('mode') ?? 'ranked'; // 'ranked' | 'farming' | 'all'

  // Build mode filter
  const modeFilter = mode === 'all'
    ? undefined
    : eq(battles.battleMode, mode);

  const userFilter = or(
    eq(battles.challengerUserId, session.userId),
    eq(battles.defenderUserId, session.userId),
  );

  const whereClause = modeFilter
    ? and(userFilter, modeFilter)
    : userFilter;

  // Fetch battles where user is challenger or defender
  const myBattles = await db
    .select()
    .from(battles)
    .where(whereClause)
    .orderBy(desc(battles.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(battles)
    .where(whereClause);

  // Collect unique creature IDs for name lookup
  const creatureIds = new Set<string>();
  for (const b of myBattles) {
    creatureIds.add(b.challengerCreatureId);
    creatureIds.add(b.defenderCreatureId);
  }

  // Batch fetch creature names
  const creatureNameMap = new Map<string, string>();
  if (creatureIds.size > 0) {
    const creatureRows = await db
      .select({ id: creatures.id, name: creatures.name })
      .from(creatures)
      .where(
        or(...[...creatureIds].map((cid) => eq(creatures.id, cid))),
      );
    for (const c of creatureRows) {
      creatureNameMap.set(c.id, c.name);
    }
  }

  const result = myBattles.map((b) => {
    const isChallenger = b.challengerUserId === session.userId;
    const isDraw = b.winnerCreatureId === null;
    const myCreatureId = isChallenger ? b.challengerCreatureId : b.defenderCreatureId;
    const opponentCreatureId = isChallenger ? b.defenderCreatureId : b.challengerCreatureId;
    const won = !isDraw && (
      (isChallenger && b.winnerCreatureId === b.challengerCreatureId) ||
      (!isChallenger && b.winnerCreatureId === b.defenderCreatureId)
    );

    const myEloBefore = isChallenger ? b.challengerEloBefore : b.defenderEloBefore;
    const myEloAfter = isChallenger ? b.challengerEloAfter : b.defenderEloAfter;

    return {
      battleId: b.id,
      opponentName: creatureNameMap.get(opponentCreatureId) ?? 'Sconosciuto',
      myCreatureName: creatureNameMap.get(myCreatureId) ?? 'Sconosciuto',
      result: isDraw ? 'draw' : won ? 'victory' : 'defeat',
      eloDelta: myEloAfter - myEloBefore,
      eloBefore: myEloBefore,
      eloAfter: myEloAfter,
      wasChallenger: isChallenger,
      roundsPlayed: b.roundsPlayed,
      date: b.createdAt.toISOString(),
      replayUrl: `/api/arena/battles/${b.id}`,
    };
  });

  return NextResponse.json({
    data: result,
    meta: {
      total: countResult?.count ?? 0,
      limit,
      offset,
    },
  });
}
