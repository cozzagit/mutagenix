import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  breedingRequests,
  breedingRecords,
  creatures,
  creatureLineage,
  users,
  clans,
  clanMemberships,
  playerRelationships,
} from '@/lib/db/schema';
import { eq, and, sql, or } from 'drizzle-orm';
import { BREEDING_CONFIG } from '@/lib/game-engine/breeding-config';
import {
  calculateOffspring,
  type BreedingParent,
} from '@/lib/game-engine/genetics-engine';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import type { ElementLevels, TraitValues } from '@/types/game';
import type {
  ElementLevels as SchemaElementLevels,
  TraitValues as SchemaTraitValues,
} from '@/lib/db/schema/creatures';
import { getCreatureCariche } from '@/lib/game-engine/cariche-loader';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { id: requestId } = await params;

  if (!requestId || typeof requestId !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'ID della richiesta obbligatorio.' } },
      { status: 400 },
    );
  }

  // 1. Fetch breeding request
  const [breedingRequest] = await db
    .select()
    .from(breedingRequests)
    .where(eq(breedingRequests.id, requestId));

  if (!breedingRequest) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Richiesta di riproduzione non trovata.' } },
      { status: 404 },
    );
  }

  if (breedingRequest.targetId !== session.userId) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Non sei il destinatario di questa richiesta.' } },
      { status: 403 },
    );
  }

  if (breedingRequest.status !== 'pending') {
    return NextResponse.json(
      { error: { code: 'INVALID_STATUS', message: 'Questa richiesta non è più in sospeso.' } },
      { status: 422 },
    );
  }

  const now = new Date();
  if (breedingRequest.expiresAt < now) {
    // Mark as expired
    await db
      .update(breedingRequests)
      .set({ status: 'expired' })
      .where(eq(breedingRequests.id, requestId));
    return NextResponse.json(
      { error: { code: 'EXPIRED', message: 'Questa richiesta è scaduta.' } },
      { status: 422 },
    );
  }

  // 2. Fetch both creatures
  const [requesterCreature] = await db
    .select()
    .from(creatures)
    .where(eq(creatures.id, breedingRequest.requesterCreatureId));

  const [targetCreature] = await db
    .select()
    .from(creatures)
    .where(eq(creatures.id, breedingRequest.targetCreatureId));

  if (!requesterCreature || !targetCreature) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Una delle creature non è stata trovata.' } },
      { status: 404 },
    );
  }

  // Validate both creatures still eligible
  if (requesterCreature.isArchived || requesterCreature.isDead) {
    return NextResponse.json(
      { error: { code: 'INVALID_CREATURE', message: 'La creatura del richiedente non è più disponibile.' } },
      { status: 422 },
    );
  }

  if (targetCreature.isArchived || targetCreature.isDead) {
    return NextResponse.json(
      { error: { code: 'INVALID_CREATURE', message: 'La tua creatura non è più disponibile.' } },
      { status: 422 },
    );
  }

  if (requesterCreature.familyGeneration >= BREEDING_CONFIG.MAX_GENERATIONS) {
    return NextResponse.json(
      { error: { code: 'MAX_GENERATION', message: 'La creatura del richiedente ha raggiunto la generazione massima.' } },
      { status: 422 },
    );
  }

  if (targetCreature.familyGeneration >= BREEDING_CONFIG.MAX_GENERATIONS) {
    return NextResponse.json(
      { error: { code: 'MAX_GENERATION', message: 'La tua creatura ha raggiunto la generazione massima.' } },
      { status: 422 },
    );
  }

  // Check children count
  const [reqChildCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creatureLineage)
    .where(
      and(
        eq(creatureLineage.parentId, requesterCreature.id),
        eq(creatureLineage.parentRole, 'primary'),
      ),
    );

  if ((reqChildCount?.count ?? 0) >= BREEDING_CONFIG.MAX_CHILDREN_PER_CREATURE) {
    return NextResponse.json(
      { error: { code: 'MAX_CHILDREN', message: 'La creatura del richiedente ha raggiunto il numero massimo di figli.' } },
      { status: 422 },
    );
  }

  const [tgtChildCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creatureLineage)
    .where(
      and(
        eq(creatureLineage.parentId, targetCreature.id),
        eq(creatureLineage.parentRole, 'primary'),
      ),
    );

  if ((tgtChildCount?.count ?? 0) >= BREEDING_CONFIG.MAX_CHILDREN_PER_CREATURE) {
    return NextResponse.json(
      { error: { code: 'MAX_CHILDREN', message: 'La tua creatura ha raggiunto il numero massimo di figli.' } },
      { status: 422 },
    );
  }

  // 3. Validate both users have enough energy
  const [requesterUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, breedingRequest.requesterId));

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId));

  // Patriarca della Stirpe discount: -15% breeding cost
  const [requesterCariche, targetCariche] = await Promise.all([
    getCreatureCariche(requesterCreature.id),
    getCreatureCariche(targetCreature.id),
  ]);
  const hasPatriarca = requesterCariche.includes('patriarca') || targetCariche.includes('patriarca');
  const patriarcaDiscount = hasPatriarca ? 0.85 : 1;
  const energyCost = Math.floor(breedingRequest.energyCost * patriarcaDiscount);

  if (!requesterUser || requesterUser.energy < energyCost) {
    return NextResponse.json(
      { error: { code: 'INSUFFICIENT_ENERGY', message: 'Il richiedente non ha abbastanza energia.' } },
      { status: 422 },
    );
  }

  if (!targetUser || targetUser.energy < energyCost) {
    return NextResponse.json(
      { error: { code: 'INSUFFICIENT_ENERGY', message: 'Non hai abbastanza energia.' } },
      { status: 422 },
    );
  }

  // 4. Deduct energy from both users
  await db
    .update(users)
    .set({ energy: requesterUser.energy - energyCost, updatedAt: now })
    .where(eq(users.id, breedingRequest.requesterId));

  await db
    .update(users)
    .set({ energy: targetUser.energy - energyCost, updatedAt: now })
    .where(eq(users.id, session.userId));

  // 5. Run genetics engine
  const seedString = `${breedingRequest.id}:${Date.now()}`;

  const parentA: BreedingParent = {
    id: requesterCreature.id,
    elementLevels: requesterCreature.elementLevels as unknown as Record<string, number>,
    traitValues: requesterCreature.traitValues as unknown as Record<string, number>,
    stability: requesterCreature.stability ?? 0.5,
    foundingElements: requesterCreature.foundingElements ?? null,
    growthElements: requesterCreature.growthElements ?? null,
    ageDays: requesterCreature.ageDays ?? 0,
    familyGeneration: requesterCreature.familyGeneration,
  };

  const parentB: BreedingParent = {
    id: targetCreature.id,
    elementLevels: targetCreature.elementLevels as unknown as Record<string, number>,
    traitValues: targetCreature.traitValues as unknown as Record<string, number>,
    stability: targetCreature.stability ?? 0.5,
    foundingElements: targetCreature.foundingElements ?? null,
    growthElements: targetCreature.growthElements ?? null,
    ageDays: targetCreature.ageDays ?? 0,
    familyGeneration: targetCreature.familyGeneration,
  };

  const breedingResult = calculateOffspring(parentA, parentB, seedString);

  // 6. Create offspring creatures
  const offspringAVisual = mapTraitsToVisuals(
    breedingResult.offspringA.traitValues as unknown as TraitValues,
    breedingResult.offspringA.elementLevels as unknown as ElementLevels,
    [],
    breedingResult.offspringA.foundingElements,
    breedingResult.offspringA.growthElements,
  );

  const offspringBVisual = mapTraitsToVisuals(
    breedingResult.offspringB.traitValues as unknown as TraitValues,
    breedingResult.offspringB.elementLevels as unknown as ElementLevels,
    [],
    breedingResult.offspringB.foundingElements,
    breedingResult.offspringB.growthElements,
  );

  const [offspringA] = await db
    .insert(creatures)
    .values({
      userId: breedingRequest.requesterId,
      name: `Figlio di ${requesterCreature.name}`,
      generation: breedingResult.offspringA.familyGeneration,
      ageDays: 0,
      elementLevels: breedingResult.offspringA.elementLevels as unknown as SchemaElementLevels,
      traitValues: breedingResult.offspringA.traitValues as unknown as SchemaTraitValues,
      stability: breedingResult.offspringA.stability,
      foundingElements: breedingResult.offspringA.foundingElements,
      growthElements: null,
      visualParams: offspringAVisual as unknown as Record<string, unknown>,
      isFounder: false,
      isArchived: false,
      isDead: false,
      familyGeneration: breedingResult.offspringA.familyGeneration,
      parentACreatureId: requesterCreature.id,
      parentBCreatureId: targetCreature.id,
    })
    .returning();

  const [offspringB] = await db
    .insert(creatures)
    .values({
      userId: session.userId,
      name: `Figlio di ${targetCreature.name}`,
      generation: breedingResult.offspringB.familyGeneration,
      ageDays: 0,
      elementLevels: breedingResult.offspringB.elementLevels as unknown as SchemaElementLevels,
      traitValues: breedingResult.offspringB.traitValues as unknown as SchemaTraitValues,
      stability: breedingResult.offspringB.stability,
      foundingElements: breedingResult.offspringB.foundingElements,
      growthElements: null,
      visualParams: offspringBVisual as unknown as Record<string, unknown>,
      isFounder: false,
      isArchived: false,
      isDead: false,
      familyGeneration: breedingResult.offspringB.familyGeneration,
      parentACreatureId: targetCreature.id,
      parentBCreatureId: requesterCreature.id,
    })
    .returning();

  // 7. Create breeding record
  const [breedingRecord] = await db
    .insert(breedingRecords)
    .values({
      parentAId: requesterCreature.id,
      parentBId: targetCreature.id,
      playerAId: breedingRequest.requesterId,
      playerBId: session.userId,
      offspringAId: offspringA.id,
      offspringBId: offspringB.id,
      energyCost,
      status: 'completed',
      geneticsSeed: seedString,
    })
    .returning();

  // 8. Create creature lineage entries (4 total)
  await db.insert(creatureLineage).values([
    {
      childId: offspringA.id,
      parentId: requesterCreature.id,
      parentRole: 'primary',
      breedingId: breedingRecord.id,
    },
    {
      childId: offspringA.id,
      parentId: targetCreature.id,
      parentRole: 'partner',
      breedingId: breedingRecord.id,
    },
    {
      childId: offspringB.id,
      parentId: targetCreature.id,
      parentRole: 'primary',
      breedingId: breedingRecord.id,
    },
    {
      childId: offspringB.id,
      parentId: requesterCreature.id,
      parentRole: 'partner',
      breedingId: breedingRecord.id,
    },
  ]);

  // 9. Clan management is now manual — players create and join clans themselves.
  // No auto-creation on breeding.

  // 10. Update player relationships
  const [existingRelationship] = await db
    .select()
    .from(playerRelationships)
    .where(
      or(
        and(
          eq(playerRelationships.playerAId, breedingRequest.requesterId),
          eq(playerRelationships.playerBId, session.userId),
        ),
        and(
          eq(playerRelationships.playerAId, session.userId),
          eq(playerRelationships.playerBId, breedingRequest.requesterId),
        ),
      ),
    );

  if (existingRelationship) {
    await db
      .update(playerRelationships)
      .set({
        totalBreedings: existingRelationship.totalBreedings + 1,
        relationshipScore: existingRelationship.relationshipScore + 10,
        lastBreedingAt: now,
        updatedAt: now,
      })
      .where(eq(playerRelationships.id, existingRelationship.id));
  } else {
    await db.insert(playerRelationships).values({
      playerAId: breedingRequest.requesterId,
      playerBId: session.userId,
      totalBreedings: 1,
      relationshipScore: 10,
      lastBreedingAt: now,
    });
  }

  // 11. Update users maxCreatures
  const [reqNewCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creatures)
    .where(
      and(
        eq(creatures.userId, breedingRequest.requesterId),
        eq(creatures.isArchived, false),
        eq(creatures.isDead, false),
      ),
    );

  await db
    .update(users)
    .set({
      maxCreatures: sql`GREATEST(${users.maxCreatures}, ${reqNewCount?.count ?? 1})`,
    })
    .where(eq(users.id, breedingRequest.requesterId));

  const [tgtNewCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creatures)
    .where(
      and(
        eq(creatures.userId, session.userId),
        eq(creatures.isArchived, false),
        eq(creatures.isDead, false),
      ),
    );

  await db
    .update(users)
    .set({
      maxCreatures: sql`GREATEST(${users.maxCreatures}, ${tgtNewCount?.count ?? 1})`,
    })
    .where(eq(users.id, session.userId));

  // 12. Update breeding request status
  await db
    .update(breedingRequests)
    .set({ status: 'accepted', respondedAt: now })
    .where(eq(breedingRequests.id, requestId));

  // 13. Return both offspring data
  return NextResponse.json({
    data: {
      breedingRecordId: breedingRecord.id,
      anomalies: breedingResult.anomalies,
      offspringA: {
        id: offspringA.id,
        name: offspringA.name,
        familyGeneration: offspringA.familyGeneration,
        stability: offspringA.stability,
        elementLevels: offspringA.elementLevels,
        traitValues: offspringA.traitValues,
        visualParams: offspringAVisual,
        ownerId: breedingRequest.requesterId,
      },
      offspringB: {
        id: offspringB.id,
        name: offspringB.name,
        familyGeneration: offspringB.familyGeneration,
        stability: offspringB.stability,
        elementLevels: offspringB.elementLevels,
        traitValues: offspringB.traitValues,
        visualParams: offspringBVisual,
        ownerId: session.userId,
      },
    },
  }, { status: 201 });
}
