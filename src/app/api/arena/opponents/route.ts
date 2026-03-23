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
