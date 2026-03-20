import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, dailySnapshots, mutationLog } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { EvolutionLog } from '@/components/lab/evolution-log';

export const dynamic = 'force-dynamic';

export default async function EvolutionLogPage() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    redirect('/login');
  }

  const [creature] = await db
    .select()
    .from(creatures)
    .where(and(eq(creatures.userId, session.userId), eq(creatures.isArchived, false)));

  if (!creature) redirect('/login');

  const snapshots = await db
    .select()
    .from(dailySnapshots)
    .where(eq(dailySnapshots.creatureId, creature.id))
    .orderBy(desc(dailySnapshots.day));

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

  const timelineData = snapshots.map((snapshot, index) => ({
    snapshot,
    mutations: mutationsByDay.get(snapshot.day) ?? [],
    dayNumber: snapshots.length - index,
  }));

  return (
    <EvolutionLog
      timelineData={timelineData}
      creatureName={creature.name}
    />
  );
}
