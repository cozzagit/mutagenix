// ---------------------------------------------------------------------------
// Mutagenix – Kinship Engine (pure, no DB)
// ---------------------------------------------------------------------------
// Calculates genetic relationship between two creatures using ancestry data.
// Returns malus/bonus multipliers for combat and team affinity.
// ---------------------------------------------------------------------------

export interface KinshipResult {
  level: number; // 0=unrelated, 1=parent-child/siblings, 2=grandparent/uncle, 3=cousins
  relationship: string; // Italian description
  malusMultiplier: number; // 0.0 to 0.15
  bonusMultiplier: number; // 0.0 to 0.05 (for teammates)
}

export interface CreatureAncestry {
  id: string;
  parentAId: string | null;
  parentBId: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getParentIds(creature: CreatureAncestry): string[] {
  const parents: string[] = [];
  if (creature.parentAId) parents.push(creature.parentAId);
  if (creature.parentBId) parents.push(creature.parentBId);
  return parents;
}

function findById(
  id: string,
  all: CreatureAncestry[],
): CreatureAncestry | undefined {
  return all.find((c) => c.id === id);
}

/** Collect ancestor IDs up to `maxDepth` levels above the given creature. */
function collectAncestors(
  creature: CreatureAncestry,
  all: CreatureAncestry[],
  maxDepth: number,
): Set<string> {
  const ancestors = new Set<string>();
  let frontier: string[] = [creature.id];

  for (let depth = 0; depth < maxDepth; depth++) {
    const nextFrontier: string[] = [];
    for (const id of frontier) {
      const c = findById(id, all);
      if (!c) continue;
      for (const pid of getParentIds(c)) {
        if (!ancestors.has(pid)) {
          ancestors.add(pid);
          nextFrontier.push(pid);
        }
      }
    }
    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }
  return ancestors;
}

/** Get the set of grandparent IDs (parents of parents). */
function getGrandparentIds(
  creature: CreatureAncestry,
  all: CreatureAncestry[],
): Set<string> {
  const gpIds = new Set<string>();
  for (const pid of getParentIds(creature)) {
    const parent = findById(pid, all);
    if (!parent) continue;
    for (const gpid of getParentIds(parent)) {
      gpIds.add(gpid);
    }
  }
  return gpIds;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const UNRELATED: KinshipResult = {
  level: 0,
  relationship: 'Nessuna parentela',
  malusMultiplier: 0,
  bonusMultiplier: 0,
};

export function calculateKinship(
  creatureA: CreatureAncestry,
  creatureB: CreatureAncestry,
  allCreatures: CreatureAncestry[],
): KinshipResult {
  // --- Level 1: Direct parent-child ---
  const aParents = getParentIds(creatureA);
  const bParents = getParentIds(creatureB);

  if (aParents.includes(creatureB.id) || bParents.includes(creatureA.id)) {
    return {
      level: 1,
      relationship: 'Genitore-Figlio',
      malusMultiplier: 0.15,
      bonusMultiplier: 0.05,
    };
  }

  // --- Level 1: Siblings (share at least one parent) ---
  if (
    aParents.length > 0 &&
    bParents.length > 0 &&
    aParents.some((p) => bParents.includes(p))
  ) {
    return {
      level: 1,
      relationship: 'Fratelli',
      malusMultiplier: 0.12,
      bonusMultiplier: 0.05,
    };
  }

  // --- Level 2: Grandparent (A is parent of B's parent, or vice versa) ---
  const aGrandparents = getGrandparentIds(creatureA, allCreatures);
  const bGrandparents = getGrandparentIds(creatureB, allCreatures);

  if (bGrandparents.has(creatureA.id)) {
    return {
      level: 2,
      relationship: 'Nonno-Nipote',
      malusMultiplier: 0.08,
      bonusMultiplier: 0.03,
    };
  }
  if (aGrandparents.has(creatureB.id)) {
    return {
      level: 2,
      relationship: 'Nonno-Nipote',
      malusMultiplier: 0.08,
      bonusMultiplier: 0.03,
    };
  }

  // --- Level 2: Uncle/nephew ---
  // A's parent is B's grandparent (but A is NOT B's parent — already checked)
  for (const pid of aParents) {
    if (bGrandparents.has(pid)) {
      return {
        level: 2,
        relationship: 'Zio-Nipote',
        malusMultiplier: 0.06,
        bonusMultiplier: 0.03,
      };
    }
  }
  for (const pid of bParents) {
    if (aGrandparents.has(pid)) {
      return {
        level: 2,
        relationship: 'Zio-Nipote',
        malusMultiplier: 0.06,
        bonusMultiplier: 0.03,
      };
    }
  }

  // --- Level 3: Cousins (share a grandparent) ---
  for (const gp of aGrandparents) {
    if (bGrandparents.has(gp)) {
      return {
        level: 3,
        relationship: 'Cugini',
        malusMultiplier: 0.04,
        bonusMultiplier: 0.02,
      };
    }
  }

  return UNRELATED;
}
