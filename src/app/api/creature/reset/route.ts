import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSession, unauthorizedResponse } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures } from '@/lib/db/schema';
import { DEFAULT_ELEMENT_LEVELS, DEFAULT_TRAIT_VALUES } from '@/lib/db/schema/creatures';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  // Parse optional body for archive reason
  let reason: 'reset' | 'failed' = 'reset';
  try {
    const body = await request.json();
    if (body?.reason === 'failed') {
      reason = 'failed';
    }
  } catch {
    // No body or invalid JSON — default to 'reset'
  }

  // Find the current active (non-archived) creature
  const [creature] = await db
    .select()
    .from(creatures)
    .where(
      and(
        eq(creatures.userId, session.userId),
        eq(creatures.isArchived, false),
      ),
    );

  if (!creature) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Nessuna creatura attiva trovata' } },
      { status: 404 },
    );
  }

  const now = new Date();
  const newGeneration = (creature.generation ?? 1) + 1;

  // 1. Archive the current creature (keep all data intact)
  await db
    .update(creatures)
    .set({
      isArchived: true,
      archivedAt: now,
      archiveReason: reason,
      updatedAt: now,
    })
    .where(eq(creatures.id, creature.id));

  // 2. Create a NEW fresh creature for the user
  const [newCreature] = await db
    .insert(creatures)
    .values({
      userId: session.userId,
      name: `Specimen-${String(newGeneration).padStart(3, '0')}`,
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
      isArchived: false,
    })
    .returning();

  return NextResponse.json({
    data: {
      success: true,
      generation: newGeneration,
      creatureId: newCreature.id,
      archivedCreatureId: creature.id,
      archiveReason: reason,
    },
  });
}
