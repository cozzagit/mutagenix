import { NextResponse } from 'next/server';
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
  users,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import type { TraitValues, ElementLevels } from '@/types/game';

export async function GET() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  // 1. Invites TO the user's creatures (direction = 'invite', targetUserId = me)
  const incomingInvites = await db
    .select({
      invitation: clanInvitations,
      clan: clans,
      creature: creatures,
    })
    .from(clanInvitations)
    .innerJoin(clans, eq(clans.id, clanInvitations.clanId))
    .innerJoin(creatures, eq(creatures.id, clanInvitations.creatureId))
    .where(
      and(
        eq(clanInvitations.targetUserId, session.userId),
        eq(clanInvitations.direction, 'invite'),
        eq(clanInvitations.status, 'pending'),
        sql`${clanInvitations.expiresAt} > NOW()`,
      ),
    );

  // 2. Requests TO clans the user bosses (direction = 'request')
  const bossedClans = await db
    .select({ clanId: clanMemberships.clanId })
    .from(clanMemberships)
    .where(
      and(
        eq(clanMemberships.userId, session.userId),
        eq(clanMemberships.role, 'boss'),
      ),
    );

  const bossedClanIds = bossedClans.map((c) => c.clanId);

  let incomingRequests: typeof incomingInvites = [];
  if (bossedClanIds.length > 0) {
    incomingRequests = await db
      .select({
        invitation: clanInvitations,
        clan: clans,
        creature: creatures,
      })
      .from(clanInvitations)
      .innerJoin(clans, eq(clans.id, clanInvitations.clanId))
      .innerJoin(creatures, eq(creatures.id, clanInvitations.creatureId))
      .where(
        and(
          sql`${clanInvitations.clanId} IN (${sql.join(bossedClanIds.map(id => sql`${id}::uuid`), sql`, `)})`,
          eq(clanInvitations.direction, 'request'),
          eq(clanInvitations.status, 'pending'),
          sql`${clanInvitations.expiresAt} > NOW()`,
        ),
      );
  }

  // Get owner names for request creatures
  const ownerIds = new Set<string>();
  for (const r of incomingRequests) {
    ownerIds.add(r.creature.userId);
  }
  const ownerMap = new Map<string, string>();
  if (ownerIds.size > 0) {
    const ownerUsers = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(sql`${users.id} IN (${sql.join([...ownerIds].map(id => sql`${id}::uuid`), sql`, `)})`);
    for (const u of ownerUsers) {
      ownerMap.set(u.id, u.displayName);
    }
  }

  const formatInvite = (item: typeof incomingInvites[0]) => {
    const traitValues = item.creature.traitValues as unknown as TraitValues;
    const elementLevels = item.creature.elementLevels as unknown as ElementLevels;
    const visualParams = mapTraitsToVisuals(
      traitValues,
      elementLevels,
      [],
      item.creature.foundingElements ?? null,
      item.creature.growthElements ?? null,
    );

    return {
      id: item.invitation.id,
      clanId: item.invitation.clanId,
      clanName: item.clan.name,
      clanEmblemColor: item.clan.emblemColor,
      creatureId: item.creature.id,
      creatureName: item.creature.name,
      creatureOwnerName: ownerMap.get(item.creature.userId) ?? '',
      direction: item.invitation.direction,
      message: item.invitation.message,
      expiresAt: item.invitation.expiresAt.toISOString(),
      visualParams: visualParams as unknown as Record<string, unknown>,
      ageDays: item.creature.ageDays ?? 0,
    };
  };

  // 3. Outgoing invites FROM clans the user bosses (direction = 'invite', all statuses)
  let outgoingInvites: typeof incomingInvites = [];
  if (bossedClanIds.length > 0) {
    outgoingInvites = await db
      .select({
        invitation: clanInvitations,
        clan: clans,
        creature: creatures,
      })
      .from(clanInvitations)
      .innerJoin(clans, eq(clans.id, clanInvitations.clanId))
      .innerJoin(creatures, eq(creatures.id, clanInvitations.creatureId))
      .where(
        and(
          sql`${clanInvitations.clanId} IN (${sql.join(bossedClanIds.map(id => sql`${id}::uuid`), sql`, `)})`,
          eq(clanInvitations.direction, 'invite'),
        ),
      );

    // Add owner names for outgoing invite creatures
    for (const o of outgoingInvites) {
      ownerIds.add(o.creature.userId);
    }
    if (ownerIds.size > 0) {
      const moreOwners = await db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(sql`${users.id} IN (${sql.join([...ownerIds].map(id => sql`${id}::uuid`), sql`, `)})`);
      for (const u of moreOwners) {
        ownerMap.set(u.id, u.displayName);
      }
    }
  }

  const formatOutgoing = (item: typeof incomingInvites[0]) => {
    const traitValues = item.creature.traitValues as unknown as TraitValues;
    const elementLevels = item.creature.elementLevels as unknown as ElementLevels;
    const visualParams = mapTraitsToVisuals(
      traitValues,
      elementLevels,
      [],
      item.creature.foundingElements ?? null,
      item.creature.growthElements ?? null,
    );

    return {
      id: item.invitation.id,
      clanId: item.invitation.clanId,
      clanName: item.clan.name,
      clanEmblemColor: item.clan.emblemColor,
      creatureId: item.creature.id,
      creatureName: item.creature.name,
      creatureOwnerName: ownerMap.get(item.creature.userId) ?? '',
      direction: item.invitation.direction,
      status: item.invitation.status,
      message: item.invitation.message,
      expiresAt: item.invitation.expiresAt.toISOString(),
      visualParams: visualParams as unknown as Record<string, unknown>,
      ageDays: item.creature.ageDays ?? 0,
    };
  };

  return NextResponse.json({
    data: {
      invites: incomingInvites.map(formatInvite),
      requests: incomingRequests.map(formatInvite),
      outgoing: outgoingInvites.map(formatOutgoing),
    },
  });
}
