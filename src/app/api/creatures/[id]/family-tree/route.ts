import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, creatureLineage, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import type { ElementLevels, TraitValues } from '@/types/game';

interface TreeNode {
  id: string;
  name: string;
  ageDays: number;
  familyGeneration: number;
  isFounder: boolean;
  isDead: boolean;
  stability: number;
  ownerName: string;
  visualParams: Record<string, unknown>;
  children: TreeNode[];
}

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

function buildTreeNode(
  creature: typeof creatures.$inferSelect,
  ownerName: string,
): TreeNode {
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
    id: creature.id,
    name: creature.name,
    ageDays: creature.ageDays ?? 0,
    familyGeneration: creature.familyGeneration,
    isFounder: creature.isFounder,
    isDead: creature.isDead,
    stability: creature.stability ?? 0.5,
    ownerName,
    visualParams: visualParams as unknown as Record<string, unknown>,
    children: [],
  };
}

/** Walk up to find the root ancestor (founder). */
async function findRoot(creatureId: string): Promise<string> {
  let currentId = creatureId;
  const visited = new Set<string>();

  while (true) {
    if (visited.has(currentId)) break; // prevent infinite loops
    visited.add(currentId);

    const [creature] = await db
      .select({ id: creatures.id, parentACreatureId: creatures.parentACreatureId })
      .from(creatures)
      .where(eq(creatures.id, currentId));

    if (!creature || !creature.parentACreatureId) {
      return currentId; // this is the root
    }

    currentId = creature.parentACreatureId;
  }

  return currentId;
}

/** Recursively build the tree downward from a creature. */
async function buildTreeDown(creatureId: string, depth: number = 0): Promise<TreeNode | null> {
  if (depth > 10) return null; // safety limit

  const data = await getCreatureWithOwner(creatureId);
  if (!data) return null;

  const node = buildTreeNode(data.creature, data.ownerName);

  // Find children via lineage (where this creature is the primary parent)
  const childLineages = await db
    .select({ childId: creatureLineage.childId })
    .from(creatureLineage)
    .where(
      and(
        eq(creatureLineage.parentId, creatureId),
        eq(creatureLineage.parentRole, 'primary'),
      ),
    );

  for (const lineage of childLineages) {
    const childNode = await buildTreeDown(lineage.childId, depth + 1);
    if (childNode) {
      node.children.push(childNode);
    }
  }

  return node;
}

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

  // Build full tree from root downward
  const tree = await buildTreeDown(rootId);

  if (!tree) {
    return NextResponse.json(
      { error: { code: 'TREE_ERROR', message: 'Impossibile costruire l\'albero genealogico.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: {
      rootCreatureId: rootId,
      requestedCreatureId: creatureId,
      tree,
    },
  });
}
