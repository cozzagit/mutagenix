import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, dailySnapshots } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { EvolutionDiary } from '@/components/lab/evolution-diary';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import type { TraitValues, ElementLevels } from '@/types/game';

export const dynamic = 'force-dynamic';

/**
 * Pick which day numbers to sample for the visual timeline.
 * Returns a set of day numbers (1-indexed) to keep from total days.
 * Strategy: day 1, 5, 10, 20, 30, 50, 75, 100, then every 50, plus last.
 */
function pickKeyDayNumbers(totalDays: number): Set<number> {
  const milestones = [1, 5, 10, 20, 30, 50, 75, 100];
  const set = new Set<number>();

  for (const d of milestones) {
    if (d <= totalDays) set.add(d);
  }

  // Every 50 after 100
  for (let d = 150; d <= totalDays; d += 50) {
    set.add(d);
  }

  // Always include last
  set.add(totalDays);

  return set;
}

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

  // Fetch ALL snapshots but only select minimal columns for milestone detection.
  // Then fetch full data only for key snapshots.
  // Step 1: Get all snapshot days + trait values for milestone detection (lightweight)
  const allSnapshots = await db
    .select({
      id: dailySnapshots.id,
      day: dailySnapshots.day,
      traitValues: dailySnapshots.traitValues,
      visualParams: dailySnapshots.visualParams,
      elementLevels: dailySnapshots.elementLevels,
      stabilityScore: dailySnapshots.stabilityScore,
    })
    .from(dailySnapshots)
    .where(eq(dailySnapshots.creatureId, creature.id))
    .orderBy(asc(dailySnapshots.day));

  const totalDays = allSnapshots.length;

  if (totalDays === 0) {
    return (
      <EvolutionDiary
        creatureName={creature.name}
        totalDays={0}
        elementLevels={creature.elementLevels}
        keySnapshots={[]}
        allSnapshotsForMilestones={[]}
      />
    );
  }

  // Step 2: Pick key day numbers for visual timeline
  const keyDayNumbers = pickKeyDayNumbers(totalDays);

  // Step 3: Filter key snapshots and RECALCULATE visual params with current mapper
  // This ensures the diary always reflects the latest visual engine, even if
  // snapshots were saved with an older version.
  const keySnapshots = allSnapshots
    .map((snap, index) => {
      const tv = snap.traitValues as TraitValues;
      const el = snap.elementLevels as ElementLevels;
      const freshVisuals = mapTraitsToVisuals(tv, el, []);
      return {
        dayNumber: index + 1,
        day: snap.day,
        visualParams: freshVisuals as unknown as Record<string, unknown>,
        elementLevels: snap.elementLevels,
        traitValues: snap.traitValues,
        stabilityScore: snap.stabilityScore,
      };
    })
    .filter((snap) => keyDayNumbers.has(snap.dayNumber));

  // Step 4: Prepare lightweight milestone data (every 10th day + first + last)
  const milestoneCheckDays = new Set<number>();
  milestoneCheckDays.add(1);
  for (let d = 5; d <= totalDays; d += 5) {
    milestoneCheckDays.add(d);
  }
  milestoneCheckDays.add(totalDays);

  const milestoneCandidates = allSnapshots
    .map((snap, index) => ({
      dayNumber: index + 1,
      traitValues: snap.traitValues as Record<string, number>,
      elementLevels: snap.elementLevels as Record<string, number>,
      stabilityScore: snap.stabilityScore,
    }))
    .filter((snap) => milestoneCheckDays.has(snap.dayNumber));

  return (
    <EvolutionDiary
      creatureName={creature.name}
      totalDays={totalDays}
      elementLevels={creature.elementLevels}
      keySnapshots={keySnapshots}
      allSnapshotsForMilestones={milestoneCandidates}
    />
  );
}
