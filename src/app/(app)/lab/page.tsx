import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, battles, creatureRankings, users } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
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

  // Count battles user hasn't seen (defender battles AFTER last arena visit)
  let unseenBattles = 0;
  try {
    const [user] = await db.select({ lastArenaVisit: users.lastArenaVisit })
      .from(users).where(eq(users.id, session.userId));
    const threshold = user?.lastArenaVisit ?? new Date(0); // if never visited, count all
    const [unseenCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(battles)
      .where(
        and(
          eq(battles.defenderUserId, session.userId),
          gte(battles.createdAt, threshold),
        ),
      );
    unseenBattles = unseenCount?.count ?? 0;
  } catch {
    // Arena tables may not exist yet — ignore
  }

  // Fetch arena ranking
  let ranking: { eloRating: number; wins: number; losses: number; draws: number; tier: string; axp?: number } | null = null;
  try {
    const [r] = await db.select({
      eloRating: creatureRankings.eloRating,
      wins: creatureRankings.wins,
      losses: creatureRankings.losses,
      draws: creatureRankings.draws,
      tier: creatureRankings.rankTier,
      axp: creatureRankings.axp,
    }).from(creatureRankings).where(eq(creatureRankings.creatureId, creature.id));
    ranking = r ?? null;
  } catch { /* table may not exist */ }

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
      unseenBattles={unseenBattles}
      ranking={ranking}
    />
  );
}
