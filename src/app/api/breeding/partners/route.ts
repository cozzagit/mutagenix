import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  creatures,
  users,
  creatureLineage,
} from '@/lib/db/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { BREEDING_CONFIG } from '@/lib/game-engine/breeding-config';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import { ELEMENTS, type ElementId } from '@/lib/game-engine/constants';
import type { ElementLevels, TraitValues } from '@/types/game';

export async function GET() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  // Get all eligible creatures from OTHER users
  const eligibleCreatures = await db
    .select({
      creature: creatures,
      ownerName: users.displayName,
      ownerEnergy: users.energy,
    })
    .from(creatures)
    .innerJoin(users, eq(creatures.userId, users.id))
    .where(
      and(
        ne(creatures.userId, session.userId),
        eq(creatures.isArchived, false),
        eq(creatures.isDead, false),
        sql`${creatures.familyGeneration} < ${BREEDING_CONFIG.MAX_GENERATIONS}`,
      ),
    );

  // Filter by energy and child count
  const results = [];

  for (const row of eligibleCreatures) {
    // Check owner has enough energy
    if (row.ownerEnergy < BREEDING_CONFIG.BASE_ENERGY_COST) continue;

    // Count children
    const [childCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(creatureLineage)
      .where(
        and(
          eq(creatureLineage.parentId, row.creature.id),
          eq(creatureLineage.parentRole, 'primary'),
        ),
      );

    const childCount = childCountResult?.count ?? 0;
    if (childCount >= BREEDING_CONFIG.MAX_CHILDREN_PER_CREATURE) continue;

    // Compute visual params
    const traitValues = row.creature.traitValues as unknown as TraitValues;
    const elementLevels = row.creature.elementLevels as unknown as ElementLevels;
    const visualParams = mapTraitsToVisuals(
      traitValues,
      elementLevels,
      [],
      row.creature.foundingElements,
      row.creature.growthElements,
    );

    // Top 3 elements by level
    const elementEntries = ELEMENTS
      .map((el: ElementId) => ({ elementId: el, level: elementLevels[el] ?? 0 }))
      .sort((a, b) => b.level - a.level)
      .slice(0, 3);

    // Derive tier from age
    const ageDays = row.creature.ageDays ?? 0;
    const tier = ageDays >= 500 ? 'divine' : ageDays >= 300 ? 'immortal' : ageDays > 150 ? 'legend' : ageDays > 100 ? 'veteran' : ageDays > 60 ? 'intermediate' : 'novice';

    results.push({
      creatureId: row.creature.id,
      name: row.creature.name,
      ownerName: row.ownerName,
      ageDays,
      tier,
      stability: row.creature.stability ?? 0.5,
      familyGeneration: row.creature.familyGeneration,
      visualParams,
      topElements: elementEntries,
      childCount,
    });
  }

  return NextResponse.json({ data: results });
}
