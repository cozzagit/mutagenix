import { NextResponse } from 'next/server';
import { getRequiredSession, unauthorizedResponse } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, allocations, dailySnapshots, mutationLog } from '@/lib/db/schema';
import { DEFAULT_ELEMENT_LEVELS, DEFAULT_TRAIT_VALUES } from '@/lib/db/schema/creatures';
import { eq } from 'drizzle-orm';

export async function POST() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const [creature] = await db
    .select()
    .from(creatures)
    .where(eq(creatures.userId, session.userId));

  if (!creature) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Nessuna creatura trovata' } },
      { status: 404 },
    );
  }

  // Delete all related data
  await db.delete(mutationLog).where(eq(mutationLog.creatureId, creature.id));
  await db.delete(dailySnapshots).where(eq(dailySnapshots.creatureId, creature.id));
  await db.delete(allocations).where(eq(allocations.creatureId, creature.id));

  // Reset creature to initial state
  await db
    .update(creatures)
    .set({
      name: 'Specimen-001',
      generation: (creature.generation ?? 1) + 1,
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
    data: { success: true, generation: (creature.generation ?? 1) + 1 },
  });
}
