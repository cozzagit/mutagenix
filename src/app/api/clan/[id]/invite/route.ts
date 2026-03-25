import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  clans,
  clanMemberships,
  clanInvitations,
  creatures,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

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

  // Verify caller is boss or luogotenente
  const [callerMembership] = await db
    .select()
    .from(clanMemberships)
    .where(
      and(
        eq(clanMemberships.clanId, clanId),
        eq(clanMemberships.userId, session.userId),
      ),
    );

  if (!callerMembership || !['boss', 'luogotenente'].includes(callerMembership.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Solo Boss o Luogotenente possono invitare' } },
      { status: 403 },
    );
  }

  let body: { creatureId: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Corpo richiesta non valido' } },
      { status: 400 },
    );
  }

  const { creatureId, message } = body;

  if (!creatureId) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'creatureId è obbligatorio' } },
      { status: 400 },
    );
  }

  // Verify target creature exists, alive, not archived, day >= 40
  const [creature] = await db
    .select()
    .from(creatures)
    .where(eq(creatures.id, creatureId));

  if (!creature) {
    return NextResponse.json(
      { error: { code: 'CREATURE_NOT_FOUND', message: 'Creatura non trovata' } },
      { status: 404 },
    );
  }

  if (creature.isDead || creature.isArchived) {
    return NextResponse.json(
      { error: { code: 'CREATURE_UNAVAILABLE', message: 'La creatura non è disponibile' } },
      { status: 400 },
    );
  }

  if ((creature.ageDays ?? 0) < 40) {
    return NextResponse.json(
      { error: { code: 'TOO_YOUNG', message: 'La creatura deve avere almeno 40 giorni' } },
      { status: 400 },
    );
  }

  // Check creature not already in a clan
  const [existingMembership] = await db
    .select()
    .from(clanMemberships)
    .where(eq(clanMemberships.creatureId, creatureId));

  if (existingMembership) {
    return NextResponse.json(
      { error: { code: 'ALREADY_IN_CLAN', message: 'La creatura è già in un clan' } },
      { status: 400 },
    );
  }

  // Check clan not at max members
  const [clan] = await db.select().from(clans).where(eq(clans.id, clanId));
  if (!clan) {
    return NextResponse.json(
      { error: { code: 'CLAN_NOT_FOUND', message: 'Clan non trovato' } },
      { status: 404 },
    );
  }

  if (clan.totalMembers >= clan.maxMembers) {
    return NextResponse.json(
      { error: { code: 'CLAN_FULL', message: 'Il clan ha raggiunto il numero massimo di membri' } },
      { status: 400 },
    );
  }

  // Check no pending invitation already exists
  const [existingInvite] = await db
    .select()
    .from(clanInvitations)
    .where(
      and(
        eq(clanInvitations.clanId, clanId),
        eq(clanInvitations.creatureId, creatureId),
        eq(clanInvitations.status, 'pending'),
        sql`${clanInvitations.expiresAt} > NOW()`,
      ),
    );

  if (existingInvite) {
    return NextResponse.json(
      { error: { code: 'INVITE_EXISTS', message: 'Esiste già un invito pendente per questa creatura' } },
      { status: 409 },
    );
  }

  // Create invitation
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const [invitation] = await db
    .insert(clanInvitations)
    .values({
      clanId,
      creatureId,
      inviterUserId: session.userId,
      targetUserId: creature.userId,
      direction: 'invite',
      status: 'pending',
      message: message?.trim() || null,
      expiresAt,
    })
    .returning();

  return NextResponse.json({
    data: {
      id: invitation.id,
      creatureId: invitation.creatureId,
      direction: invitation.direction,
      expiresAt: invitation.expiresAt.toISOString(),
    },
  }, { status: 201 });
}
