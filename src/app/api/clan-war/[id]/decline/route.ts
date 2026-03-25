import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { clanWars, clanMemberships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  _request: Request,
  context: RouteContext,
) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { id: warId } = await context.params;

  const [war] = await db.select().from(clanWars).where(eq(clanWars.id, warId));
  if (!war) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Guerra non trovata' } },
      { status: 404 },
    );
  }

  if (war.status !== 'pending') {
    return NextResponse.json(
      { error: { code: 'WRONG_STATUS', message: 'La guerra non è in attesa' } },
      { status: 400 },
    );
  }

  // Verify caller is boss of defender clan
  const [callerMembership] = await db
    .select()
    .from(clanMemberships)
    .where(
      and(
        eq(clanMemberships.userId, session.userId),
        eq(clanMemberships.clanId, war.defenderClanId),
        eq(clanMemberships.role, 'boss'),
      ),
    );

  if (!callerMembership) {
    return NextResponse.json(
      { error: { code: 'NOT_BOSS', message: 'Solo il Boss del clan difensore può rifiutare' } },
      { status: 403 },
    );
  }

  await db
    .update(clanWars)
    .set({ status: 'declined' })
    .where(eq(clanWars.id, warId));

  return NextResponse.json({ data: { id: warId, status: 'declined' } });
}
