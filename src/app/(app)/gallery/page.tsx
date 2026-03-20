import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, dailySnapshots } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { EvolutionTimeline } from '@/components/timeline/evolution-timeline';

export const dynamic = 'force-dynamic';

export default async function TimelinePage() {
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
    .orderBy(asc(dailySnapshots.day));

  const timelineSnapshots = snapshots.map((s) => ({
    day: s.day,
    visualParams: s.visualParams as Record<string, unknown>,
    stabilityScore: s.stabilityScore,
    elementLevels: s.elementLevels as Record<string, number>,
  }));

  const currentCreature = {
    ageDays: creature.ageDays ?? 0,
    visualParams: creature.visualParams as Record<string, unknown>,
    stability: creature.stability ?? 0.5,
  };

  return (
    <EvolutionTimeline
      snapshots={timelineSnapshots}
      currentCreature={currentCreature}
    />
  );
}
