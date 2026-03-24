import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, breedingRecords, users } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import type { ElementLevels, TraitValues } from '@/types/game';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface TreeCreature {
  creatureId: string;
  name: string;
  ageDays: number;
  familyGeneration: number;
  isFounder: boolean;
  isDead: boolean;
  isActive: boolean;
  isMine: boolean;
  ownerName: string;
  stability: number;
  visualParams: Record<string, unknown>;
}

interface BreedingEvent {
  breedingId: string;
  partnerParent: TreeCreature;
  myOffspring: TreeCreature | null;
  partnerOffspring: TreeCreature | null;
  /** Recursive breedings of myOffspring */
  childBreedings: BreedingEvent[];
}

interface FamilyTreeResponse {
  rootCreatureId: string;
  requestedCreatureId: string;
  root: TreeCreature;
  breedings: BreedingEvent[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function getCreatureWithOwner(creatureId: string) {
  const [result] = await db
    .select({
      creature: creatures,
      ownerName: users.displayName,
    })
    .from(creatures)
    .innerJoin(users, eq(creatures.userId, users.id))
    .where(eq(creatures.id, creatureId));
  return result ?? null;
}

function toTreeCreature(
  creature: typeof creatures.$inferSelect,
  ownerName: string,
  requestingUserId: string,
  activeCreatureId?: string,
): TreeCreature {
  const traitValues = creature.traitValues as unknown as TraitValues;
  const elementLevels = creature.elementLevels as unknown as ElementLevels;
  const visualParams = mapTraitsToVisuals(
    traitValues,
    elementLevels,
    [],
    creature.foundingElements,
    creature.growthElements,
  );

  return {
    creatureId: creature.id,
    name: creature.name,
    ageDays: creature.ageDays ?? 0,
    familyGeneration: creature.familyGeneration,
    isFounder: creature.isFounder,
    isDead: creature.isDead,
    isActive: creature.id === activeCreatureId,
    isMine: creature.userId === requestingUserId,
    ownerName,
    stability: creature.stability ?? 0.5,
    visualParams: visualParams as unknown as Record<string, unknown>,
  };
}

/** Walk up to find the root ancestor (founder) belonging to the requesting user. */
async function findRoot(creatureId: string): Promise<string> {
  let currentId = creatureId;
  const visited = new Set<string>();

  while (true) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const [creature] = await db
      .select({ id: creatures.id, parentACreatureId: creatures.parentACreatureId })
      .from(creatures)
      .where(eq(creatures.id, currentId));

    if (!creature || !creature.parentACreatureId) {
      return currentId;
    }

    currentId = creature.parentACreatureId;
  }

  return currentId;
}

/**
 * Recursively build family tree showing both parents and both offspring
 * for every breeding event a creature participated in.
 */
async function buildBreedings(
  creatureId: string,
  requestingUserId: string,
  activeCreatureId: string | undefined,
  depth: number = 0,
  visited: Set<string> = new Set(),
): Promise<BreedingEvent[]> {
  if (depth > 5 || visited.has(creatureId)) return [];
  visited.add(creatureId);

  // Find all breeding records where this creature was a parent
  const records = await db
    .select()
    .from(breedingRecords)
    .where(
      or(
        eq(breedingRecords.parentAId, creatureId),
        eq(breedingRecords.parentBId, creatureId),
      ),
    );

  const events: BreedingEvent[] = [];

  for (const record of records) {
    // Determine partner parent
    const partnerId = record.parentAId === creatureId
      ? record.parentBId
      : record.parentAId;

    const partnerData = await getCreatureWithOwner(partnerId);
    if (!partnerData) continue;

    // Get both offspring
    const offspringAData = record.offspringAId
      ? await getCreatureWithOwner(record.offspringAId)
      : null;
    const offspringBData = record.offspringBId
      ? await getCreatureWithOwner(record.offspringBId)
      : null;

    // Determine which offspring is "mine" (belongs to the requesting user)
    const allOffspring = [offspringAData, offspringBData].filter(Boolean) as NonNullable<typeof offspringAData>[];
    const myOffspringData = allOffspring.find(o => o.creature.userId === requestingUserId) ?? null;
    const partnerOffspringData = allOffspring.find(o => o.creature.userId !== requestingUserId) ?? null;

    const myOffspring = myOffspringData
      ? toTreeCreature(myOffspringData.creature, myOffspringData.ownerName, requestingUserId, activeCreatureId)
      : null;
    const partnerOffspring = partnerOffspringData
      ? toTreeCreature(partnerOffspringData.creature, partnerOffspringData.ownerName, requestingUserId, activeCreatureId)
      : null;

    // Recursively get breedings for my offspring
    const childBreedings = myOffspring
      ? await buildBreedings(myOffspring.creatureId, requestingUserId, activeCreatureId, depth + 1, visited)
      : [];

    events.push({
      breedingId: record.id,
      partnerParent: toTreeCreature(partnerData.creature, partnerData.ownerName, requestingUserId, activeCreatureId),
      myOffspring,
      partnerOffspring,
      childBreedings,
    });
  }

  return events;
}

/* ------------------------------------------------------------------ */
/* Route handler                                                       */
/* ------------------------------------------------------------------ */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { id: creatureId } = await params;

  if (!creatureId || typeof creatureId !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'ID della creatura obbligatorio.' } },
      { status: 400 },
    );
  }

  // Verify creature exists
  const [creature] = await db
    .select()
    .from(creatures)
    .where(eq(creatures.id, creatureId));

  if (!creature) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Creatura non trovata.' } },
      { status: 404 },
    );
  }

  // Walk up to find the root
  const rootId = await findRoot(creatureId);

  const rootData = await getCreatureWithOwner(rootId);
  if (!rootData) {
    return NextResponse.json(
      { error: { code: 'TREE_ERROR', message: 'Impossibile costruire l\'albero genealogico.' } },
      { status: 500 },
    );
  }

  const root = toTreeCreature(rootData.creature, rootData.ownerName, session.userId, creatureId);

  // Build all breeding events starting from root, recursively following "my" offspring
  const breedings = await buildBreedings(rootId, session.userId, creatureId);

  const response: FamilyTreeResponse = {
    rootCreatureId: rootId,
    requestedCreatureId: creatureId,
    root,
    breedings,
  };

  return NextResponse.json({ data: response });
}
