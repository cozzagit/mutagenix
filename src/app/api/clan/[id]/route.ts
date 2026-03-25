import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  clans,
  clanMemberships,
  creatures,
  users,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import type { TraitValues, ElementLevels } from '@/types/game';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;

  const [clan] = await db
    .select()
    .from(clans)
    .where(eq(clans.id, id));

  if (!clan) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Clan non trovato' } },
      { status: 404 },
    );
  }

  // Get all members
  const members = await db
    .select({
      membership: clanMemberships,
      creature: creatures,
      ownerName: users.displayName,
    })
    .from(clanMemberships)
    .innerJoin(creatures, eq(creatures.id, clanMemberships.creatureId))
    .innerJoin(users, eq(users.id, clanMemberships.userId))
    .where(eq(clanMemberships.clanId, clan.id));

  const memberList = members.map((m) => {
    const traitValues = m.creature.traitValues as unknown as TraitValues;
    const elementLevels = m.creature.elementLevels as unknown as ElementLevels;
    const visualParams = mapTraitsToVisuals(
      traitValues,
      elementLevels,
      [],
      m.creature.foundingElements ?? null,
      m.creature.growthElements ?? null,
    );

    return {
      creatureId: m.creature.id,
      name: m.creature.name,
      ownerName: m.ownerName,
      role: m.membership.role,
      ageDays: m.creature.ageDays ?? 0,
      joinedAt: m.membership.joinedAt.toISOString(),
      contributionScore: m.membership.contributionScore,
      visualParams: visualParams as unknown as Record<string, unknown>,
      isDead: m.creature.isDead,
    };
  });

  return NextResponse.json({
    data: {
      clan: {
        id: clan.id,
        name: clan.name,
        motto: clan.motto,
        emblemColor: clan.emblemColor,
        status: clan.status,
        clanElo: clan.clanElo,
        clanEloPeak: clan.clanEloPeak,
        prestige: clan.prestige,
        clanWins: clan.clanWins,
        clanLosses: clan.clanLosses,
        totalMembers: clan.totalMembers,
        maxMembers: clan.maxMembers,
        description: clan.description,
        createdAt: clan.createdAt.toISOString(),
      },
      members: memberList,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await context.params;

  // Check user is boss of this clan
  const [bossMembership] = await db
    .select()
    .from(clanMemberships)
    .where(
      and(
        eq(clanMemberships.clanId, id),
        eq(clanMemberships.userId, session.userId),
        eq(clanMemberships.role, 'boss'),
      ),
    );

  if (!bossMembership) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Solo il Boss può modificare il clan' } },
      { status: 403 },
    );
  }

  let body: { name?: string; motto?: string; emblemColor?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Corpo richiesta non valido' } },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const trimmedName = body.name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 24) {
      return NextResponse.json(
        { error: { code: 'INVALID_NAME', message: 'Il nome deve essere tra 1 e 24 caratteri' } },
        { status: 400 },
      );
    }
    // Check uniqueness
    const [existing] = await db
      .select()
      .from(clans)
      .where(eq(clans.name, trimmedName));
    if (existing && existing.id !== id) {
      return NextResponse.json(
        { error: { code: 'NAME_TAKEN', message: 'Nome già in uso' } },
        { status: 409 },
      );
    }
    updates.name = trimmedName;
  }

  if (body.motto !== undefined) updates.motto = body.motto.trim() || null;
  if (body.emblemColor !== undefined) updates.emblemColor = body.emblemColor || null;
  if (body.description !== undefined) updates.description = body.description.trim() || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: { code: 'NO_CHANGES', message: 'Nessuna modifica' } },
      { status: 400 },
    );
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(clans)
    .set(updates)
    .where(eq(clans.id, id))
    .returning();

  return NextResponse.json({
    data: {
      id: updated.id,
      name: updated.name,
      motto: updated.motto,
      emblemColor: updated.emblemColor,
      description: updated.description,
    },
  });
}
