import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSession, unauthorizedResponse } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, dailySnapshots, mutationLog } from '@/lib/db/schema';
import { eq, desc, and, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    let session;
    try {
      session = await getRequiredSession();
    } catch {
      return unauthorizedResponse();
    }

    const url = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '30', 10), 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10), 0);

    const [creature] = await db
      .select()
      .from(creatures)
      .where(eq(creatures.userId, session.userId));

    if (!creature) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Creature not found' } },
        { status: 404 },
      );
    }

    const [totalResult] = await db
      .select({ count: count() })
      .from(dailySnapshots)
      .where(eq(dailySnapshots.creatureId, creature.id));

    const total = totalResult?.count ?? 0;

    const snapshots = await db
      .select()
      .from(dailySnapshots)
      .where(eq(dailySnapshots.creatureId, creature.id))
      .orderBy(desc(dailySnapshots.day))
      .limit(limit)
      .offset(offset);

    if (snapshots.length === 0) {
      return NextResponse.json({
        data: { snapshots: [], total },
      });
    }

    const snapshotDays = snapshots.map((s) => s.day);

    const mutations = await db
      .select()
      .from(mutationLog)
      .where(eq(mutationLog.creatureId, creature.id))
      .orderBy(desc(mutationLog.day));

    const mutationsByDay = new Map<string, typeof mutations>();
    for (const entry of mutations) {
      if (!snapshotDays.includes(entry.day)) continue;
      const existing = mutationsByDay.get(entry.day) ?? [];
      existing.push(entry);
      mutationsByDay.set(entry.day, existing);
    }

    const enrichedSnapshots = snapshots.map((snapshot) => ({
      ...snapshot,
      mutations: mutationsByDay.get(snapshot.day) ?? [],
    }));

    return NextResponse.json({
      data: {
        snapshots: enrichedSnapshots,
        total,
      },
      meta: {
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Mutations API error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
