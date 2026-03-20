import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
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

  let [creature] = await db
    .select()
    .from(creatures)
    .where(eq(creatures.userId, session.userId));

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

  // Can allocate: no active mutation + cooldown passed
  let canAllocate = !interpolated.mutationActive;
  if (canAllocate && creature.updatedAt && (creature.ageDays ?? 0) > 0) {
    const timeSinceUpdate = Date.now() - creature.updatedAt.getTime();
    if (timeSinceUpdate < TIME_CONFIG.COOLDOWN_MS) {
      canAllocate = false;
    }
  }

  return NextResponse.json({
    data: {
      id: creature.id,
      name: creature.name,
      generation: creature.generation,
      ageDays: creature.ageDays,

      current: {
        elementLevels: interpolated.elementLevels,
        traitValues: interpolated.traitValues,
        visualParams: interpolated.visualParams,
        stability: interpolated.stability,
      },

      target: creature.targetVisualParams
        ? {
            elementLevels: creature.targetElementLevels,
            traitValues: creature.targetTraitValues,
            visualParams: creature.targetVisualParams,
          }
        : null,

      progress: interpolated.progress,
      mutationActive: interpolated.mutationActive,
      mutationPhase: interpolated.mutationPhase,
      canAllocate,
      isDevMode: TIME_CONFIG.isDevMode,
    },
  });
}

export async function PATCH(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).name !== 'string'
  ) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'name must be a string' } },
      { status: 400 },
    );
  }

  const rawName = ((body as Record<string, unknown>).name as string).trim();

  if (rawName.length < 1 || rawName.length > 24) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'name must be between 1 and 24 characters',
        },
      },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(creatures)
    .set({ name: rawName, updatedAt: new Date() })
    .where(eq(creatures.userId, session.userId))
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Nessuna creatura trovata' } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: {
      id: updated.id,
      name: updated.name,
    },
  });
}
