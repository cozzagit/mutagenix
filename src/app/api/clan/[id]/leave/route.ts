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
} from '@/lib/db/schema';
import { eq, and, sql, ne } from 'drizzle-orm';
import { calculateBetrayalDamage } from '@/lib/game-engine/clan-engine';
import type { TraitValues } from '@/types/game';

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

  let body: { creatureId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Corpo richiesta non valido' } },
      { status: 400 },
    );
  }

  const { creatureId } = body;
  if (!creatureId) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'creatureId è obbligatorio' } },
      { status: 400 },
    );
  }

  // Verify creature belongs to user and is in this clan
  const [membership] = await db
    .select({ membership: clanMemberships, creature: creatures })
    .from(clanMemberships)
    .innerJoin(creatures, eq(creatures.id, clanMemberships.creatureId))
    .where(
      and(
        eq(clanMemberships.clanId, clanId),
        eq(clanMemberships.creatureId, creatureId),
        eq(clanMemberships.userId, session.userId),
      ),
    );

  if (!membership) {
    return NextResponse.json(
      { error: { code: 'NOT_IN_CLAN', message: 'La creatura non è in questo clan' } },
      { status: 400 },
    );
  }

  const [clan] = await db.select().from(clans).where(eq(clans.id, clanId));
  if (!clan) {
    return NextResponse.json(
      { error: { code: 'CLAN_NOT_FOUND', message: 'Clan non trovato' } },
      { status: 404 },
    );
  }

  // Load all OTHER clan members' creature combat stats
  const otherMembers = await db
    .select({
      creature: creatures,
    })
    .from(clanMemberships)
    .innerJoin(creatures, eq(creatures.id, clanMemberships.creatureId))
    .where(
      and(
        eq(clanMemberships.clanId, clanId),
        ne(clanMemberships.creatureId, creatureId),
      ),
    );

  const traitorCreature = membership.creature;
  const traitorTraits = traitorCreature.traitValues as unknown as TraitValues;

  const clanMemberStats = otherMembers.map((m) => {
    const traits = m.creature.traitValues as unknown as TraitValues;
    return {
      name: m.creature.name,
      attackPower: traits.attackPower ?? 0,
      specialAttack: traits.specialAttack ?? 0,
    };
  });

  // Calculate betrayal damage
  const seed = Date.now() ^ creatureId.charCodeAt(0);
  const betrayalResult = calculateBetrayalDamage(
    clanMemberStats,
    {
      name: traitorCreature.name,
      attackPower: traitorTraits.attackPower ?? 0,
      defense: traitorTraits.defense ?? 0,
      stamina: traitorTraits.stamina ?? 0,
      speed: traitorTraits.speed ?? 0,
      specialAttack: traitorTraits.specialAttack ?? 0,
    },
    seed,
  );

  // Apply permanent stat loss to the leaving creature's traitValues
  const updatedTraits = { ...(traitorTraits as Record<string, number>) };
  for (const [trait, loss] of Object.entries(betrayalResult.traitLosses)) {
    if (trait in updatedTraits) {
      updatedTraits[trait] = Math.max(0, (updatedTraits[trait] ?? 0) - loss);
    }
  }

  // Update creature: set traitor flag, apply stat loss
  await db
    .update(creatures)
    .set({
      traitValues: updatedTraits as TraitValues,
      isTraitor: true,
      betrayedClanName: clan.name,
      updatedAt: new Date(),
    })
    .where(eq(creatures.id, creatureId));

  // Delete the membership row
  await db
    .delete(clanMemberships)
    .where(
      and(
        eq(clanMemberships.clanId, clanId),
        eq(clanMemberships.creatureId, creatureId),
      ),
    );

  // Handle boss leaving: promote highest contribution luogotenente, or oldest soldato
  if (membership.membership.role === 'boss') {
    const [newBoss] = await db
      .select()
      .from(clanMemberships)
      .where(eq(clanMemberships.clanId, clanId))
      .orderBy(
        sql`CASE WHEN ${clanMemberships.role} = 'luogotenente' THEN 0 ELSE 1 END`,
        sql`${clanMemberships.contributionScore} DESC`,
        sql`${clanMemberships.joinedAt} ASC`,
      )
      .limit(1);

    if (newBoss) {
      await db
        .update(clanMemberships)
        .set({ role: 'boss' })
        .where(eq(clanMemberships.id, newBoss.id));

      // Update clan ownerId
      await db
        .update(clans)
        .set({ ownerId: newBoss.userId, updatedAt: new Date() })
        .where(eq(clans.id, clanId));
    }
  }

  // Update clan totalMembers and check if should disband
  const newTotal = Math.max(0, clan.totalMembers - 1);
  if (newTotal === 0) {
    // Disband clan
    await db
      .update(clans)
      .set({
        totalMembers: 0,
        status: 'disbanded',
        updatedAt: new Date(),
      })
      .where(eq(clans.id, clanId));
  } else {
    await db
      .update(clans)
      .set({
        totalMembers: newTotal,
        status: newTotal >= 3 ? 'active' : 'forming',
        updatedAt: new Date(),
      })
      .where(eq(clans.id, clanId));
  }

  // Generate a betrayal ID (use creature ID + timestamp as a simple approach)
  const betrayalId = `${creatureId}-${Date.now()}`;

  return NextResponse.json({
    data: {
      betrayalId,
      betrayalResult: {
        totalStatLossPercent: betrayalResult.totalStatLossPercent,
        strikes: betrayalResult.strikes,
        traitLosses: betrayalResult.traitLosses,
        traitorName: traitorCreature.name,
        clanName: clan.name,
      },
    },
  });
}
