import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  creatures,
  users,
  breedingRequests,
  breedingRecords,
  creatureLineage,
} from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { BREEDING_CONFIG } from '@/lib/game-engine/breeding-config';

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  let body: { targetCreatureId?: string; creatureId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Corpo della richiesta non valido.' } },
      { status: 400 },
    );
  }

  const { targetCreatureId, creatureId, message } = body;

  if (!targetCreatureId || typeof targetCreatureId !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'ID della creatura bersaglio obbligatorio.' } },
      { status: 400 },
    );
  }

  if (!creatureId || typeof creatureId !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'ID della tua creatura obbligatorio.' } },
      { status: 400 },
    );
  }

  // Fetch requester creature
  const [requesterCreature] = await db
    .select()
    .from(creatures)
    .where(eq(creatures.id, creatureId));

  if (!requesterCreature) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'La tua creatura non è stata trovata.' } },
      { status: 404 },
    );
  }

  if (requesterCreature.userId !== session.userId) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Non sei il proprietario di questa creatura.' } },
      { status: 403 },
    );
  }

  if (requesterCreature.isArchived || requesterCreature.isDead) {
    return NextResponse.json(
      { error: { code: 'INVALID_CREATURE', message: 'La tua creatura non è disponibile per la riproduzione.' } },
      { status: 422 },
    );
  }

  if (requesterCreature.familyGeneration >= BREEDING_CONFIG.MAX_GENERATIONS) {
    return NextResponse.json(
      { error: { code: 'MAX_GENERATION', message: 'La tua creatura ha raggiunto la generazione massima e non può riprodursi.' } },
      { status: 422 },
    );
  }

  // Fetch target creature
  const [targetCreature] = await db
    .select()
    .from(creatures)
    .where(eq(creatures.id, targetCreatureId));

  if (!targetCreature) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Creatura bersaglio non trovata.' } },
      { status: 404 },
    );
  }

  if (targetCreature.userId === session.userId) {
    return NextResponse.json(
      { error: { code: 'SELF_BREEDING', message: 'Non puoi riprodurre le tue creature tra loro.' } },
      { status: 422 },
    );
  }

  if (targetCreature.isArchived || targetCreature.isDead) {
    return NextResponse.json(
      { error: { code: 'INVALID_CREATURE', message: 'La creatura bersaglio non è disponibile per la riproduzione.' } },
      { status: 422 },
    );
  }

  if (targetCreature.familyGeneration >= BREEDING_CONFIG.MAX_GENERATIONS) {
    return NextResponse.json(
      { error: { code: 'MAX_GENERATION', message: 'La creatura bersaglio ha raggiunto la generazione massima.' } },
      { status: 422 },
    );
  }

  // Check child count for requester creature
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
      { error: { code: 'MAX_CHILDREN', message: 'La tua creatura ha raggiunto il numero massimo di figli.' } },
      { status: 422 },
    );
  }

  // Check child count for target creature
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
      { error: { code: 'MAX_CHILDREN', message: 'La creatura bersaglio ha raggiunto il numero massimo di figli.' } },
      { status: 422 },
    );
  }

  // Check requester energy
  const [requesterUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId));

  const energyCost = Math.round(
    BREEDING_CONFIG.BASE_ENERGY_COST *
    Math.pow(BREEDING_CONFIG.GENERATION_COST_MULTIPLIER, requesterCreature.familyGeneration - 1),
  );

  if (!requesterUser || requesterUser.energy < energyCost) {
    return NextResponse.json(
      { error: { code: 'INSUFFICIENT_ENERGY', message: `Energia insufficiente. Servono ${energyCost} punti energia.` } },
      { status: 422 },
    );
  }

  // Check both users haven't exceeded maxCreatures
  const [reqCreatureCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creatures)
    .where(
      and(
        eq(creatures.userId, session.userId),
        eq(creatures.isArchived, false),
        eq(creatures.isDead, false),
      ),
    );

  if ((reqCreatureCount?.count ?? 0) >= BREEDING_CONFIG.MAX_CREATURES_PER_PLAYER) {
    return NextResponse.json(
      { error: { code: 'MAX_CREATURES', message: 'Hai raggiunto il numero massimo di creature.' } },
      { status: 422 },
    );
  }

  const [tgtCreatureCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creatures)
    .where(
      and(
        eq(creatures.userId, targetCreature.userId),
        eq(creatures.isArchived, false),
        eq(creatures.isDead, false),
      ),
    );

  if ((tgtCreatureCount?.count ?? 0) >= BREEDING_CONFIG.MAX_CREATURES_PER_PLAYER) {
    return NextResponse.json(
      { error: { code: 'MAX_CREATURES', message: 'Il giocatore bersaglio ha raggiunto il numero massimo di creature.' } },
      { status: 422 },
    );
  }

  // Check no pending request between these two creatures
  const [existingRequest] = await db
    .select()
    .from(breedingRequests)
    .where(
      and(
        eq(breedingRequests.requesterCreatureId, creatureId),
        eq(breedingRequests.targetCreatureId, targetCreatureId),
        eq(breedingRequests.status, 'pending'),
      ),
    );

  if (existingRequest) {
    return NextResponse.json(
      { error: { code: 'DUPLICATE_REQUEST', message: 'Esiste già una richiesta in sospeso tra queste due creature.' } },
      { status: 409 },
    );
  }

  // Check breeding cooldown on requester creature
  const [lastBreeding] = await db
    .select()
    .from(breedingRecords)
    .where(
      sql`(${breedingRecords.parentAId} = ${requesterCreature.id} OR ${breedingRecords.parentBId} = ${requesterCreature.id})`,
    )
    .orderBy(desc(breedingRecords.createdAt))
    .limit(1);

  if (lastBreeding) {
    const timeSinceLastBreeding = Date.now() - lastBreeding.createdAt.getTime();
    if (timeSinceLastBreeding < BREEDING_CONFIG.BREEDING_COOLDOWN_MS) {
      const remainingHours = Math.ceil(
        (BREEDING_CONFIG.BREEDING_COOLDOWN_MS - timeSinceLastBreeding) / (1000 * 60 * 60),
      );
      return NextResponse.json(
        { error: { code: 'BREEDING_COOLDOWN', message: `La tua creatura è in cooldown. Riprova tra ${remainingHours} ore.` } },
        { status: 422 },
      );
    }
  }

  // Create breeding request
  const expiresAt = new Date(Date.now() + BREEDING_CONFIG.REQUEST_EXPIRY_HOURS * 60 * 60 * 1000);

  const [newRequest] = await db
    .insert(breedingRequests)
    .values({
      requesterId: session.userId,
      targetId: targetCreature.userId,
      requesterCreatureId: creatureId,
      targetCreatureId,
      status: 'pending',
      message: message ?? null,
      energyCost,
      expiresAt,
    })
    .returning();

  return NextResponse.json({
    data: {
      requestId: newRequest.id,
      energyCost,
      expiresAt: expiresAt.toISOString(),
    },
  }, { status: 201 });
}
