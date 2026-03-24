import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  breedingRequests,
  creatures,
  users,
} from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import type { ElementLevels, TraitValues } from '@/types/game';

export async function GET() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  // Get pending incoming requests
  const requests = await db
    .select({
      request: breedingRequests,
      requesterCreature: creatures,
      requesterName: users.displayName,
    })
    .from(breedingRequests)
    .innerJoin(creatures, eq(breedingRequests.requesterCreatureId, creatures.id))
    .innerJoin(users, eq(breedingRequests.requesterId, users.id))
    .where(
      and(
        eq(breedingRequests.targetId, session.userId),
        eq(breedingRequests.status, 'pending'),
      ),
    )
    .orderBy(desc(breedingRequests.createdAt));

  const now = new Date();
  const results = requests
    .filter((r) => r.request.expiresAt > now) // exclude expired
    .map((r) => {
      const traitValues = r.requesterCreature.traitValues as unknown as TraitValues;
      const elementLevels = r.requesterCreature.elementLevels as unknown as ElementLevels;
      const visualParams = mapTraitsToVisuals(
        traitValues,
        elementLevels,
        [],
        r.requesterCreature.foundingElements,
        r.requesterCreature.growthElements,
      );

      return {
        requestId: r.request.id,
        requesterId: r.request.requesterId,
        requesterCreatureId: r.request.requesterCreatureId,
        targetCreatureId: r.request.targetCreatureId,
        message: r.request.message,
        energyCost: r.request.energyCost,
        expiresAt: r.request.expiresAt.toISOString(),
        createdAt: r.request.createdAt.toISOString(),
        requesterCreature: {
          id: r.requesterCreature.id,
          name: r.requesterCreature.name,
          ageDays: r.requesterCreature.ageDays ?? 0,
          stability: r.requesterCreature.stability ?? 0.5,
          familyGeneration: r.requesterCreature.familyGeneration,
          ownerName: r.requesterName,
          visualParams,
        },
      };
    });

  return NextResponse.json({ data: results });
}
