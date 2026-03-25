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

type RouteContext = { params: Promise<{ id: string; invId: string }> };

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

  const { id: clanId, invId } = await context.params;

  let body: { action: 'accept' | 'reject' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Corpo richiesta non valido' } },
      { status: 400 },
    );
  }

  if (!['accept', 'reject'].includes(body.action)) {
    return NextResponse.json(
      { error: { code: 'INVALID_ACTION', message: 'action deve essere accept o reject' } },
      { status: 400 },
    );
  }

  // Fetch invitation
  const [invitation] = await db
    .select()
    .from(clanInvitations)
    .where(
      and(
        eq(clanInvitations.id, invId),
        eq(clanInvitations.clanId, clanId),
      ),
    );

  if (!invitation) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Invito non trovato' } },
      { status: 404 },
    );
  }

  if (invitation.status !== 'pending') {
    return NextResponse.json(
      { error: { code: 'ALREADY_RESPONDED', message: 'Invito già gestito' } },
      { status: 400 },
    );
  }

  if (invitation.expiresAt < new Date()) {
    return NextResponse.json(
      { error: { code: 'EXPIRED', message: 'Invito scaduto' } },
      { status: 400 },
    );
  }

  // Authorization check based on direction
  if (invitation.direction === 'invite') {
    // Only the target user (creature owner) can accept/reject
    if (invitation.targetUserId !== session.userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Solo il destinatario può rispondere' } },
        { status: 403 },
      );
    }
  } else if (invitation.direction === 'request') {
    // Only the boss of the clan can accept/reject
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
        { error: { code: 'FORBIDDEN', message: 'Solo il Boss può approvare le richieste' } },
        { status: 403 },
      );
    }
  }

  const now = new Date();

  if (body.action === 'reject') {
    await db
      .update(clanInvitations)
      .set({ status: 'rejected', respondedAt: now })
      .where(eq(clanInvitations.id, invId));

    return NextResponse.json({ data: { status: 'rejected' } });
  }

  // Accept flow
  // Verify creature still valid
  const [creature] = await db
    .select()
    .from(creatures)
    .where(eq(creatures.id, invitation.creatureId));

  if (!creature || creature.isDead || creature.isArchived) {
    await db
      .update(clanInvitations)
      .set({ status: 'rejected', respondedAt: now })
      .where(eq(clanInvitations.id, invId));

    return NextResponse.json(
      { error: { code: 'CREATURE_UNAVAILABLE', message: 'La creatura non è più disponibile' } },
      { status: 400 },
    );
  }

  // Check creature not already in a clan (could have joined between invite and accept)
  const [existingMembership] = await db
    .select()
    .from(clanMemberships)
    .where(eq(clanMemberships.creatureId, invitation.creatureId));

  if (existingMembership) {
    await db
      .update(clanInvitations)
      .set({ status: 'rejected', respondedAt: now })
      .where(eq(clanInvitations.id, invId));

    return NextResponse.json(
      { error: { code: 'ALREADY_IN_CLAN', message: 'La creatura è già in un clan' } },
      { status: 400 },
    );
  }

  // Check clan not full
  const [clan] = await db.select().from(clans).where(eq(clans.id, clanId));
  if (!clan || clan.totalMembers >= clan.maxMembers) {
    return NextResponse.json(
      { error: { code: 'CLAN_FULL', message: 'Il clan è al completo' } },
      { status: 400 },
    );
  }

  // Create membership
  await db.insert(clanMemberships).values({
    clanId,
    creatureId: invitation.creatureId,
    userId: creature.userId,
    role: 'soldato',
  });

  // Update clan totalMembers and possibly status
  const newTotal = clan.totalMembers + 1;
  const newStatus = newTotal >= 3 && clan.status === 'forming' ? 'active' : clan.status;

  await db
    .update(clans)
    .set({
      totalMembers: newTotal,
      status: newStatus,
      updatedAt: now,
    })
    .where(eq(clans.id, clanId));

  // Mark invitation as accepted
  await db
    .update(clanInvitations)
    .set({ status: 'accepted', respondedAt: now })
    .where(eq(clanInvitations.id, invId));

  return NextResponse.json({
    data: {
      status: 'accepted',
      clanStatus: newStatus,
      totalMembers: newTotal,
    },
  });
}
