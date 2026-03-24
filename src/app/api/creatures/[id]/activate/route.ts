import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { id: creatureId } = await params;

  if (!creatureId || typeof creatureId !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'ID della creatura obbligatorio.' } },
      { status: 400 },
    );
  }

  // Fetch creature
  const [creature] = await db
    .select()
    .from(creatures)
    .where(eq(creatures.id, creatureId));

  if (!creature) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Creatura non trovata.' } },
      { status: 404 },
    );
  }

  if (creature.userId !== session.userId) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Non sei il proprietario di questa creatura.' } },
      { status: 403 },
    );
  }

  if (creature.isDead) {
    return NextResponse.json(
      { error: { code: 'DEAD_CREATURE', message: 'Non puoi attivare una creatura morta.' } },
      { status: 422 },
    );
  }

  if (creature.isArchived) {
    return NextResponse.json(
      { error: { code: 'ARCHIVED_CREATURE', message: 'Non puoi attivare una creatura archiviata.' } },
      { status: 422 },
    );
  }

  // Update active creature
  await db
    .update(users)
    .set({ activeCreatureId: creature.id, updatedAt: new Date() })
    .where(eq(users.id, session.userId));

  return NextResponse.json({
    data: {
      activeCreatureId: creature.id,
      name: creature.name,
    },
  });
}
