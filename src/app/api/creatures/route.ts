import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import type { ElementLevels, TraitValues } from '@/types/game';

export async function GET() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  // Get user to check activeCreatureId
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId));

  if (!user) {
    return unauthorizedResponse();
  }

  // Get all non-archived creatures for the user
  const userCreatures = await db
    .select()
    .from(creatures)
    .where(
      and(
        eq(creatures.userId, session.userId),
        eq(creatures.isArchived, false),
      ),
    );

  // Collect parent IDs that we need to resolve names for
  const parentIds = new Set<string>();
  for (const c of userCreatures) {
    if (c.parentACreatureId) parentIds.add(c.parentACreatureId);
    if (c.parentBCreatureId) parentIds.add(c.parentBCreatureId);
  }

  // Batch fetch parent names
  const parentNameMap: Record<string, string> = {};
  if (parentIds.size > 0) {
    for (const pid of parentIds) {
      const [parent] = await db
        .select({ id: creatures.id, name: creatures.name })
        .from(creatures)
        .where(eq(creatures.id, pid));
      if (parent) {
        parentNameMap[parent.id] = parent.name;
      }
    }
  }

  const results = userCreatures.map((c) => {
    const traitValues = c.traitValues as unknown as TraitValues;
    const elementLevels = c.elementLevels as unknown as ElementLevels;
    const visualParams = mapTraitsToVisuals(
      traitValues,
      elementLevels,
      [],
      c.foundingElements,
      c.growthElements,
    );

    return {
      id: c.id,
      name: c.name,
      ageDays: c.ageDays ?? 0,
      familyGeneration: c.familyGeneration,
      isFounder: c.isFounder,
      isDead: c.isDead,
      stability: c.stability ?? 0.5,
      visualParams,
      isActive: c.id === user.activeCreatureId,
      parentNames: {
        parentA: c.parentACreatureId ? parentNameMap[c.parentACreatureId] ?? null : null,
        parentB: c.parentBCreatureId ? parentNameMap[c.parentBCreatureId] ?? null : null,
      },
    };
  });

  return NextResponse.json({ data: results });
}
