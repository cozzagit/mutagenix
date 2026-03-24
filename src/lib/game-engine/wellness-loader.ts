// ---------------------------------------------------------------------------
// Mutagenix – Wellness Data Loader
// ---------------------------------------------------------------------------
// Queries the database to assemble WellnessInput from existing tables.
// ---------------------------------------------------------------------------

import { db } from '@/lib/db';
import { allocations } from '@/lib/db/schema';
import { creatureRankings } from '@/lib/db/schema/creature-rankings';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { TIME_CONFIG } from './time-config';
import type { WellnessInput } from './wellness';

/**
 * Load wellness input data for a creature from existing DB tables.
 * No new columns required — uses allocations timestamps and ranking data.
 */
export async function loadWellnessInput(
  creatureId: string,
  rankingData?: {
    lastBattleAt: Date | null;
    battlesToday: number;
  } | null,
): Promise<WellnessInput> {
  const now = new Date();

  // Activity window: 72h prod / compressed in dev
  const timeScale = TIME_CONFIG.isDevMode ? 480 : 1;
  const activityWindowMs = (72 * 60 * 60 * 1000) / timeScale;
  const windowStart = new Date(now.getTime() - activityWindowMs);

  // Fetch most recent injection and count recent injections in one query batch
  const [recentAllocations, lastAllocation] = await Promise.all([
    // Count injections in activity window
    db
      .select({ count: sql<number>`count(*)` })
      .from(allocations)
      .where(
        and(
          eq(allocations.creatureId, creatureId),
          gte(allocations.createdAt, windowStart),
        ),
      ),
    // Most recent injection
    db
      .select({ createdAt: allocations.createdAt })
      .from(allocations)
      .where(eq(allocations.creatureId, creatureId))
      .orderBy(desc(allocations.createdAt))
      .limit(1),
  ]);

  // If ranking data not provided, fetch it
  let battleData = rankingData;
  if (!battleData) {
    const [ranking] = await db
      .select({
        lastBattleAt: creatureRankings.lastBattleAt,
        battlesToday: creatureRankings.battlesToday,
      })
      .from(creatureRankings)
      .where(eq(creatureRankings.creatureId, creatureId));

    battleData = ranking ?? { lastBattleAt: null, battlesToday: 0 };
  }

  // Reset battlesToday if from a previous day
  let battlesToday = battleData.battlesToday;
  if (battleData.lastBattleAt) {
    const lastDate = new Date(battleData.lastBattleAt);
    const isNewDay =
      lastDate.getUTCDate() !== now.getUTCDate() ||
      lastDate.getUTCMonth() !== now.getUTCMonth() ||
      lastDate.getUTCFullYear() !== now.getUTCFullYear();
    if (isNewDay) battlesToday = 0;
  }

  return {
    lastInjectionAt: lastAllocation[0]?.createdAt ?? null,
    recentInjectionCount: Number(recentAllocations[0]?.count ?? 0),
    lastBattleAt: battleData.lastBattleAt,
    battlesToday,
    now,
  };
}
