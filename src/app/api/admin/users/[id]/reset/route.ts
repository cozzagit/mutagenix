import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  creatures,
  allocations,
  dailySnapshots,
  mutationLog,
  DEFAULT_ELEMENT_LEVELS,
  DEFAULT_TRAIT_VALUES,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  if (!session.isAdmin) {
    return forbiddenResponse('Accesso riservato agli admin');
  }

  const { id } = await ctx.params;

  // Find the active creature for this user
  const [creature] = await db
    .select()
    .from(creatures)
    .where(and(eq(creatures.userId, id), eq(creatures.isArchived, false)));

  if (!creature) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Nessuna creatura trovata per questo utente',
        },
      },
      { status: 404 },
    );
  }

  // Delete all related data
  await db.delete(mutationLog).where(eq(mutationLog.creatureId, creature.id));
  await db
    .delete(dailySnapshots)
    .where(eq(dailySnapshots.creatureId, creature.id));
  await db.delete(allocations).where(eq(allocations.creatureId, creature.id));

  // Reset creature to initial state
  const newGeneration = (creature.generation ?? 1) + 1;
  await db
    .update(creatures)
    .set({
      name: 'Specimen-001',
      generation: newGeneration,
      ageDays: 0,
      stability: 0.5,
      elementLevels: DEFAULT_ELEMENT_LEVELS,
      traitValues: DEFAULT_TRAIT_VALUES,
      visualParams: {},
      targetElementLevels: null,
      targetTraitValues: null,
      targetVisualParams: null,
      mutationStartedAt: null,
      mutationEndsAt: null,
      updatedAt: new Date(),
    })
    .where(eq(creatures.id, creature.id));

  return NextResponse.json({
    data: { success: true, generation: newGeneration },
  });
}
