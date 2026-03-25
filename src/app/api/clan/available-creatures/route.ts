import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  creatures,
  clanMemberships,
  users,
} from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import type { TraitValues, ElementLevels } from '@/types/game';

export async function GET() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  // Get all creatures that are: alive, not archived, day >= 40, NOT in any clan, NOT owned by the caller
  const allCreatures = await db
    .select({
      creature: creatures,
      ownerName: users.displayName,
    })
    .from(creatures)
    .innerJoin(users, eq(users.id, creatures.userId))
    .where(
      and(
        eq(creatures.isDead, false),
        eq(creatures.isArchived, false),
        gte(creatures.ageDays, 40),
        sql`${creatures.userId} != ${session.userId}`,
      ),
    );

  // Get all creature IDs that are already in clans
  const inClan = await db
    .select({ creatureId: clanMemberships.creatureId })
    .from(clanMemberships);
  const inClanSet = new Set(inClan.map((m) => m.creatureId));

  // Filter out creatures already in clans
  const available = allCreatures
    .filter((c) => !inClanSet.has(c.creature.id))
    .slice(0, 50) // limit results
    .map((c) => {
      const traitValues = c.creature.traitValues as unknown as TraitValues;
      const elementLevels = c.creature.elementLevels as unknown as ElementLevels;
      const visualParams = mapTraitsToVisuals(
        traitValues,
        elementLevels,
        [],
        c.creature.foundingElements ?? null,
        c.creature.growthElements ?? null,
      );

      return {
        creatureId: c.creature.id,
        name: c.creature.name,
        ownerName: c.ownerName,
        ageDays: c.creature.ageDays ?? 0,
        visualParams: visualParams as unknown as Record<string, unknown>,
      };
    });

  return NextResponse.json({ data: available });
}
