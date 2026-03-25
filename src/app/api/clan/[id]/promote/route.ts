import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { clanMemberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { id: clanId } = await context.params;

  // Check caller is boss
  const [bossMembership] = await db
    .select()
    .from(clanMemberships)
    .where(
      and(
        eq(clanMemberships.clanId, clanId),
        eq(clanMemberships.userId, session.userId),
        eq(clanMemberships.role, 'boss'),
      ),
    );

  if (!bossMembership) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Solo il Boss può promuovere i membri' } },
      { status: 403 },
    );
  }

  let body: { creatureId: string; role: 'luogotenente' | 'soldato' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Corpo richiesta non valido' } },
      { status: 400 },
    );
  }

  if (!body.creatureId || !['luogotenente', 'soldato'].includes(body.role)) {
    return NextResponse.json(
      { error: { code: 'INVALID_FIELDS', message: 'creatureId e role (luogotenente|soldato) sono obbligatori' } },
      { status: 400 },
    );
  }

  // Find the target membership
  const [targetMembership] = await db
    .select()
    .from(clanMemberships)
    .where(
      and(
        eq(clanMemberships.clanId, clanId),
        eq(clanMemberships.creatureId, body.creatureId),
      ),
    );

  if (!targetMembership) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Membro non trovato nel clan' } },
      { status: 404 },
    );
  }

  if (targetMembership.role === 'boss') {
    return NextResponse.json(
      { error: { code: 'CANNOT_DEMOTE_BOSS', message: 'Non puoi cambiare il ruolo del Boss' } },
      { status: 400 },
    );
  }

  await db
    .update(clanMemberships)
    .set({ role: body.role })
    .where(eq(clanMemberships.id, targetMembership.id));

  return NextResponse.json({
    data: {
      creatureId: body.creatureId,
      newRole: body.role,
    },
  });
}
