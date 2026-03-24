// ---------------------------------------------------------------------------
// Mutagenix – Squad Auto-Rotate (pure, no DB)
// ---------------------------------------------------------------------------
// Selects the best N creatures from a pool based on a fitness score.
// Used by the squad system to auto-fill starter slots.
// ---------------------------------------------------------------------------

export interface RotationCandidate {
  creatureId: string;
  attackPower: number;
  defense: number;
  speed: number;
  stamina: number;
  hpPercent: number; // 0-100, for tournament persistent damage
  isDead: boolean;
  isArchived: boolean;
  wellness: { composite: number };
}

/**
 * Calculate fitness score for a single candidate.
 * Dead or archived creatures score 0.
 */
function fitnessScore(c: RotationCandidate): number {
  if (c.isDead || c.isArchived) return 0;
  const statSum = c.attackPower + c.defense + c.speed + c.stamina;
  const hpFactor = c.hpPercent / 100;
  const wellnessFactor = c.wellness.composite / 100;
  return hpFactor * statSum * wellnessFactor;
}

/**
 * Returns the best `count` creature IDs sorted by fitness (descending).
 * Filters out dead and archived creatures before ranking.
 */
export function selectBestCreatures(
  candidates: RotationCandidate[],
  count: number,
): string[] {
  return candidates
    .filter((c) => !c.isDead && !c.isArchived)
    .map((c) => ({ id: c.creatureId, score: fitnessScore(c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((c) => c.id);
}
