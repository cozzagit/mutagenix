import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  users,
  creatures,
  allocations,
  dailySnapshots,
  mutationLog,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function DELETE(
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

  // Check user exists
  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id));

  if (!targetUser) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Utente non trovato' } },
      { status: 404 },
    );
  }

  // Find creature for cascade delete
  const [creature] = await db
    .select({ id: creatures.id })
    .from(creatures)
    .where(eq(creatures.userId, id));

  if (creature) {
    // Delete related data first
    await db
      .delete(mutationLog)
      .where(eq(mutationLog.creatureId, creature.id));
    await db
      .delete(dailySnapshots)
      .where(eq(dailySnapshots.creatureId, creature.id));
    await db
      .delete(allocations)
      .where(eq(allocations.creatureId, creature.id));
    // Delete creature
    await db.delete(creatures).where(eq(creatures.id, creature.id));
  }

  // Delete user
  await db.delete(users).where(eq(users.id, id));

  return NextResponse.json({ data: { success: true } });
}
