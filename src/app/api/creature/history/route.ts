import { NextResponse } from 'next/server';
import { getRequiredSession, unauthorizedResponse } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, dailySnapshots, mutationLog } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  try {
    let session;
    try {
      session = await getRequiredSession();
    } catch {
      return unauthorizedResponse();
    }

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

    const snapshots = await db
      .select()
      .from(dailySnapshots)
      .where(eq(dailySnapshots.creatureId, creature.id))
      .orderBy(desc(dailySnapshots.day))
      .limit(30);

    const mutations = await db
      .select()
      .from(mutationLog)
      .where(eq(mutationLog.creatureId, creature.id))
      .orderBy(desc(mutationLog.day));

    const mutationsByDay = new Map<string, typeof mutations>();
    for (const entry of mutations) {
      const existing = mutationsByDay.get(entry.day) ?? [];
      existing.push(entry);
      mutationsByDay.set(entry.day, existing);
    }

    const history = snapshots.map((snapshot) => ({
      day: snapshot.day,
      elementLevels: snapshot.elementLevels,
      traitValues: snapshot.traitValues,
      visualParams: snapshot.visualParams,
      stabilityScore: snapshot.stabilityScore,
      mutations: mutationsByDay.get(snapshot.day) ?? [],
    }));

    return NextResponse.json({
      data: history,
    });
  } catch (error) {
    console.error('Creature history API error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
