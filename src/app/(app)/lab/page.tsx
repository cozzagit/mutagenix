import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { LabDashboard } from '@/components/lab/lab-dashboard';
import { interpolateCreatureState } from '@/lib/game-engine/interpolation';
import { finalizeIfExpired } from '@/lib/game-engine/auto-finalize';
import { TIME_CONFIG } from '@/lib/game-engine/time-config';

export const dynamic = 'force-dynamic';

export default async function LabPage() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    redirect('/login');
  }

  let [creature] = await db
    .select()
    .from(creatures)
    .where(and(eq(creatures.userId, session.userId), eq(creatures.isArchived, false)));

  if (!creature) redirect('/login');

  // Auto-finalize if mutation has expired
  creature = await finalizeIfExpired(creature);

  // Compute interpolated visible state
  const now = new Date();
  const interpolated = interpolateCreatureState(creature, now);

  // Can allocate if: no active mutation AND cooldown passed
  let canAllocate = !interpolated.mutationActive;
  if (canAllocate && creature.updatedAt && (creature.ageDays ?? 0) > 0) {
    const timeSinceUpdate = Date.now() - creature.updatedAt.getTime();
    if (timeSinceUpdate < TIME_CONFIG.COOLDOWN_MS) {
      canAllocate = false;
    }
  }

  // Cooldown remaining
  let cooldownRemaining = 0;
  if (!canAllocate && !interpolated.mutationActive && creature.updatedAt) {
    cooldownRemaining = Math.max(0, TIME_CONFIG.COOLDOWN_MS - (Date.now() - creature.updatedAt.getTime()));
  }

  return (
    <LabDashboard
      creature={creature}
      todayAllocation={null}
      canAllocate={canAllocate}
      mutationActive={interpolated.mutationActive}
      mutationProgress={interpolated.progress}
      currentVisualParams={interpolated.visualParams as unknown as Record<string, unknown>}
      currentElementLevels={interpolated.elementLevels as Record<string, number>}
      timeUntilNextDay={0}
      dayKey={String(creature.ageDays ?? 0)}
      isDevMode={TIME_CONFIG.isDevMode}
      cooldownRemaining={cooldownRemaining}
    />
  );
}
