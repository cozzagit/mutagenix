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

  // Verify creature belongs to user, alive, not archived, day >= 40
  const [creature] = await db
    .select()
    .from(creatures)
    .where(
      and(
        eq(creatures.id, creatureId),
        eq(creatures.userId, session.userId),
      ),
    );

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

  // Check clan exists and is forming or active
  const [clan] = await db.select().from(clans).where(eq(clans.id, clanId));
  if (!clan) {
    return NextResponse.json(
      { error: { code: 'CLAN_NOT_FOUND', message: 'Clan non trovato' } },
      { status: 404 },
    );
  }

  if (!['forming', 'active'].includes(clan.status)) {
    return NextResponse.json(
      { error: { code: 'CLAN_CLOSED', message: 'Il clan non accetta nuovi membri' } },
      { status: 400 },
    );
  }

  if (clan.totalMembers >= clan.maxMembers) {
    return NextResponse.json(
      { error: { code: 'CLAN_FULL', message: 'Il clan è al completo' } },
      { status: 400 },
    );
  }

  // Check no pending request already exists
  const [existingRequest] = await db
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

  if (existingRequest) {
    return NextResponse.json(
      { error: { code: 'REQUEST_EXISTS', message: 'Hai già una richiesta pendente per questo clan' } },
      { status: 409 },
    );
  }

  // Create request (direction = 'request')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [invitation] = await db
    .insert(clanInvitations)
    .values({
      clanId,
      creatureId,
      inviterUserId: session.userId,
      targetUserId: clan.ownerId, // boss receives the request
      direction: 'request',
      status: 'pending',
      message: message?.trim() || null,
      expiresAt,
    })
    .returning();

  return NextResponse.json({
    data: {
      id: invitation.id,
      clanId: invitation.clanId,
      direction: invitation.direction,
      expiresAt: invitation.expiresAt.toISOString(),
    },
  }, { status: 201 });
}
