// ---------------------------------------------------------------------------
// Mutagenix – Auto-Finalize Expired Mutations
// ---------------------------------------------------------------------------
// Copies target state to current state for creatures whose mutation window
// has elapsed, then clears the target fields and increments ageDays.

import { db } from '@/lib/db';
import { creatures, type Creature } from '@/lib/db/schema/creatures';
import { eq, isNotNull, lte, and } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Finalize a single creature (used inline on creature access)
// ---------------------------------------------------------------------------

/**
 * If the creature's mutation has expired, finalize it by copying target state
 * to current state, clearing target fields, and incrementing ageDays.
 *
 * Returns the updated creature row, or the original if no finalization was needed.
 */
export async function finalizeIfExpired(creature: Creature): Promise<Creature> {
  if (
    !creature.targetVisualParams ||
    !creature.targetElementLevels ||
    !creature.targetTraitValues ||
    !creature.mutationEndsAt
  ) {
    return creature;
  }

  if (creature.mutationEndsAt.getTime() > Date.now()) {
    return creature;
  }

  // Mutation has expired — finalize
  const updatedFields = {
    elementLevels: creature.targetElementLevels,
    traitValues: creature.targetTraitValues,
    visualParams: creature.targetVisualParams,
    stability: creature.stability,
    ageDays: (creature.ageDays ?? 0) + 1,
    targetElementLevels: null,
    targetTraitValues: null,
    targetVisualParams: null,
    mutationStartedAt: null,
    mutationEndsAt: null,
    updatedAt: new Date(),
  };

  const [updated] = await db
    .update(creatures)
    .set(updatedFields)
    .where(eq(creatures.id, creature.id))
    .returning();

  return updated ?? creature;
}

// ---------------------------------------------------------------------------
// Batch finalize all expired mutations (periodic job)
// ---------------------------------------------------------------------------

/**
 * Find all creatures with expired mutations and finalize them.
 * Returns the number of creatures finalized.
 *
 * This can be called from a cron job, serverless function, or
 * on-demand when processing requests.
 */
export async function finalizeExpiredMutations(): Promise<number> {
  const now = new Date();

  // Find all creatures with expired mutations
  const expiredCreatures = await db
    .select()
    .from(creatures)
    .where(
      and(
        isNotNull(creatures.targetVisualParams),
        isNotNull(creatures.mutationEndsAt),
        lte(creatures.mutationEndsAt, now),
      ),
    );

  let finalized = 0;
  for (const creature of expiredCreatures) {
    await finalizeIfExpired(creature);
    finalized++;
  }

  return finalized;
}
