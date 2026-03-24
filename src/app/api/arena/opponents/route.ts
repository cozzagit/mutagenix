import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  creatures,
  creatureRankings,
} from '@/lib/db/schema';
import { users } from '@/lib/db/schema/users';
import { eq, and, ne, or, isNull, desc, sql } from 'drizzle-orm';
import { getRankTier } from '@/lib/game-engine/battle-engine';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import type { TraitValues, ElementLevels } from '@/types/game';
import type { RankTier } from '@/types/battle';
import { allocations } from '@/lib/db/schema';
import { calculateWellness, type WellnessInput } from '@/lib/game-engine/wellness';
import { TIME_CONFIG } from '@/lib/game-engine/time-config';

const ADJACENT_TIERS: Record<RankTier, RankTier[]> = {
  novice: ['novice', 'intermediate'],
  intermediate: ['novice', 'intermediate', 'veteran'],
  veteran: ['intermediate', 'veteran', 'legend'],
  legend: ['veteran', 'legend', 'immortal'],
  immortal: ['legend', 'immortal', 'divine'],
  divine: ['immortal', 'divine'],
};

function roundToNearest10(value: number): number {
  return Math.round(value / 10) * 10;
}

function getAxpTierLabel(axp: number): string {
  if (axp >= 200) return 'Maestro';
  if (axp >= 100) return 'Veterano';
  if (axp >= 50) return 'Esperto';
  return 'Recluta';
}

export async function GET() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  // Get challenger's active creature
  const [challengerCreature] = await db
    .select()
    .from(creatures)
    .where(
      and(
        eq(creatures.userId, session.userId),
        eq(creatures.isArchived, false),
      ),
    );

  if (!challengerCreature) {
    return NextResponse.json(
      { error: { code: 'NO_CREATURE', message: 'Non hai una creatura attiva.' } },
      { status: 404 },
    );
  }

  if ((challengerCreature.ageDays ?? 0) < 40) {
    return NextResponse.json(
      { error: { code: 'NOT_WARRIOR', message: 'La tua creatura non ha raggiunto la fase guerriero (giorno 40).' } },
      { status: 422 },
    );
  }

  const challengerTier = getRankTier(challengerCreature.ageDays ?? 0);
  const allowedTiers = ADJACENT_TIERS[challengerTier];
  const now = new Date();

  // Query opponents: ranked creatures in same/adjacent tier, not own, not in recovery, not archived
  const opponents = await db
    .select({
      ranking: creatureRankings,
      creature: creatures,
      ownerName: users.displayName,
    })
    .from(creatureRankings)
    .innerJoin(creatures, eq(creatures.id, creatureRankings.creatureId))
    .innerJoin(users, eq(users.id, creatureRankings.userId))
    .where(
      and(
        ne(creatureRankings.userId, session.userId),
        eq(creatures.isArchived, false),
        or(
          isNull(creatureRankings.recoveryUntil),
          sql`${creatureRankings.recoveryUntil} < now()`,
        ),
      ),
    )
    .orderBy(desc(creatureRankings.eloRating))
    .limit(50); // fetch extra, filter by tier in JS

  // Filter by allowed tiers (rankTier is text, filter in app layer for clarity)
  const filtered = opponents
    .filter((o) => allowedTiers.includes(o.ranking.rankTier as RankTier))
    .slice(0, 20);

  // Batch load wellness data for all opponents
  const creatureIds = filtered.map((o) => o.creature.id);
  const timeScale = TIME_CONFIG.isDevMode ? 480 : 1;
  const activityWindowMs = (72 * 60 * 60 * 1000) / timeScale;
  const windowStart = new Date(now.getTime() - activityWindowMs);

  // Fetch last injection + recent count for all opponents in 2 batch queries
  const idsArray = sql`ARRAY[${sql.join(creatureIds.map(id => sql`${id}::uuid`), sql`, `)}]`;
  const windowStartIso = windowStart.toISOString();
  const [lastInjections, recentCounts] = creatureIds.length > 0 ? await Promise.all([
    db.execute(sql`
      SELECT DISTINCT ON (creature_id) creature_id, created_at
      FROM allocations
      WHERE creature_id = ANY(${idsArray})
      ORDER BY creature_id, created_at DESC
    `) as Promise<{ creature_id: string; created_at: Date }[]>,
    db.execute(sql`
      SELECT creature_id, count(*) as cnt
      FROM allocations
      WHERE creature_id = ANY(${idsArray}) AND created_at >= ${windowStartIso}::timestamptz
      GROUP BY creature_id
    `) as Promise<{ creature_id: string; cnt: string }[]>,
  ]) : [[] as { creature_id: string; created_at: Date }[], [] as { creature_id: string; cnt: string }[]];

  const lastInjMap = new Map<string, Date>();
  for (const row of lastInjections) {
    lastInjMap.set(row.creature_id, new Date(row.created_at));
  }
  const recentCountMap = new Map<string, number>();
  for (const row of recentCounts) {
    recentCountMap.set(row.creature_id, Number(row.cnt));
  }

  const traitValues = (c: typeof creatures.$inferSelect) =>
    c.traitValues as Record<string, number>;

  const result = filtered.map((o) => {
    const tv = traitValues(o.creature);
    return {
      creatureId: o.creature.id,
      name: o.creature.name,
      ageDays: o.creature.ageDays,
      ownerName: o.ownerName,
      tier: o.ranking.rankTier,
      eloRating: o.ranking.eloRating,
      wins: o.ranking.wins,
      losses: o.ranking.losses,
      winStreak: o.ranking.winStreak,
      // Approximate stats (rounded to nearest 10)
      attackPower: roundToNearest10(tv.attackPower ?? 0),
      defense: roundToNearest10(tv.defense ?? 0),
      speed: roundToNearest10(tv.speed ?? 0),
      stamina: roundToNearest10(tv.stamina ?? 0),
      hp: roundToNearest10(
        (tv.bodySize ?? 0) * 2 +
        (tv.stamina ?? 0) * 3 +
        (tv.defense ?? 0) * 1.5 +
        ((tv.armoring ?? 0)) * 50 +
        (tv.battleScars ?? 0) * 2,
      ),
      axpTier: getAxpTierLabel(o.ranking.axp),
      stability: o.creature.stability ?? 0.5,
      wellness: calculateWellness({
        lastInjectionAt: lastInjMap.get(o.creature.id) ?? null,
        recentInjectionCount: recentCountMap.get(o.creature.id) ?? 0,
        lastBattleAt: o.ranking.lastBattleAt,
        battlesToday: o.ranking.battlesToday,
        now,
      } satisfies WellnessInput),
      visualParams: mapTraitsToVisuals(
        o.creature.traitValues as TraitValues,
        o.creature.elementLevels as ElementLevels,
        [],
        o.creature.foundingElements ?? null,
        o.creature.growthElements ?? null,
      ) as unknown as Record<string, unknown>,
    };
  });

  return NextResponse.json({ data: result });
}
