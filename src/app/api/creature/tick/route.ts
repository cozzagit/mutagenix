import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { interpolateCreatureState } from '@/lib/game-engine/interpolation';
import { finalizeIfExpired } from '@/lib/game-engine/auto-finalize';
import { TIME_CONFIG } from '@/lib/game-engine/time-config';

export async function GET() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const [user] = await db.select({ activeCreatureId: users.activeCreatureId })
    .from(users).where(eq(users.id, session.userId));

  let [creature] = user?.activeCreatureId
    ? await db.select().from(creatures).where(eq(creatures.id, user.activeCreatureId))
    : await db.select().from(creatures)
        .where(and(eq(creatures.userId, session.userId), eq(creatures.isArchived, false)));

  if (!creature) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Nessuna creatura trovata' } },
      { status: 404 },
    );
  }

  // Auto-finalize if mutation expired
  creature = await finalizeIfExpired(creature);

  const now = new Date();
  const interpolated = interpolateCreatureState(creature, now);

  // Can allocate if no active mutation and cooldown passed
  let canAllocate = !interpolated.mutationActive;
  if (canAllocate && creature.updatedAt && (creature.ageDays ?? 0) > 0) {
    const timeSinceUpdate = Date.now() - creature.updatedAt.getTime();
    if (timeSinceUpdate < TIME_CONFIG.COOLDOWN_MS) {
      canAllocate = false;
    }
  }

  let cooldownRemaining = 0;
  if (!canAllocate && !interpolated.mutationActive && creature.updatedAt) {
    cooldownRemaining = Math.max(0, TIME_CONFIG.COOLDOWN_MS - (Date.now() - creature.updatedAt.getTime()));
  }

  return NextResponse.json({
    data: {
      visualParams: interpolated.visualParams,
      traitValues: interpolated.traitValues,
      elementLevels: interpolated.elementLevels,
      progress: interpolated.progress,
      mutationActive: interpolated.mutationActive,
      mutationPhase: interpolated.mutationPhase,
      canAllocate,
      cooldownRemaining,
      ageDays: creature.ageDays,
      isDevMode: TIME_CONFIG.isDevMode,
    },
  });
}
