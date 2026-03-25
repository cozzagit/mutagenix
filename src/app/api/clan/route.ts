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

  // Find any clan membership for any of the user's creatures
  const membership = await db
    .select({
      membership: clanMemberships,
      clan: clans,
    })
    .from(clanMemberships)
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    .where(eq(clanMemberships.userId, session.userId))
    .limit(1);

  if (membership.length === 0) {
    return NextResponse.json({ data: null });
  }

  const { clan, membership: myMembership } = membership[0];

  // Get all members with creature + user data
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

  // Count pending invitations
  const [pendingCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(clanInvitations)
    .where(
      and(
        eq(clanInvitations.clanId, clan.id),
        eq(clanInvitations.status, 'pending'),
        sql`${clanInvitations.expiresAt} > NOW()`,
      ),
    );

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
        energyVault: clan.energyVault,
        description: clan.description,
        createdAt: clan.createdAt.toISOString(),
      },
      members: memberList,
      myRole: myMembership.role,
      myCreatureId: myMembership.creatureId,
      pendingInvitationsCount: pendingCount?.count ?? 0,
    },
  });
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  let body: { creatureId: string; name: string; motto?: string; emblemColor?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Corpo richiesta non valido' } },
      { status: 400 },
    );
  }

  const { creatureId, name, motto, emblemColor } = body;

  if (!creatureId || !name) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'creatureId e name sono obbligatori' } },
      { status: 400 },
    );
  }

  // Validate clan name
  const trimmedName = name.trim();
  if (trimmedName.length === 0 || trimmedName.length > 24) {
    return NextResponse.json(
      { error: { code: 'INVALID_NAME', message: 'Il nome del clan deve essere tra 1 e 24 caratteri' } },
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

  if (creature.isDead) {
    return NextResponse.json(
      { error: { code: 'CREATURE_DEAD', message: 'La creatura è morta' } },
      { status: 400 },
    );
  }

  if (creature.isArchived) {
    return NextResponse.json(
      { error: { code: 'CREATURE_ARCHIVED', message: 'La creatura è archiviata' } },
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

  // Check user doesn't already boss a clan
  const [existingBoss] = await db
    .select()
    .from(clanMemberships)
    .where(
      and(
        eq(clanMemberships.userId, session.userId),
        eq(clanMemberships.role, 'boss'),
      ),
    );

  if (existingBoss) {
    return NextResponse.json(
      { error: { code: 'ALREADY_BOSS', message: 'Sei già il boss di un clan' } },
      { status: 400 },
    );
  }

  // Check no clan with same name exists
  const [existingClan] = await db
    .select()
    .from(clans)
    .where(eq(clans.name, trimmedName));

  if (existingClan) {
    return NextResponse.json(
      { error: { code: 'NAME_TAKEN', message: 'Esiste già un clan con questo nome' } },
      { status: 409 },
    );
  }

  // Create clan
  const [newClan] = await db
    .insert(clans)
    .values({
      founderId: creatureId,
      ownerId: session.userId,
      name: trimmedName,
      motto: motto?.trim() || null,
      emblemColor: emblemColor || null,
      status: 'forming',
      totalMembers: 1,
    })
    .returning();

  // Create boss membership
  await db.insert(clanMemberships).values({
    clanId: newClan.id,
    creatureId,
    userId: session.userId,
    role: 'boss',
  });

  return NextResponse.json({
    data: {
      id: newClan.id,
      name: newClan.name,
      motto: newClan.motto,
      emblemColor: newClan.emblemColor,
      status: newClan.status,
    },
  }, { status: 201 });
}
