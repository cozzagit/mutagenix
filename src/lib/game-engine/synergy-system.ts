// ---------------------------------------------------------------------------
// Mutagenix – Synergy System
// ---------------------------------------------------------------------------

import {
  SYNERGIES,
  TRAITS,
  ELEMENTS,
  type Synergy,
  type TraitId,
  type ElementId,
} from './constants';

import type { ElementLevels } from '@/types/game';

export interface SynergyResult {
  activeSynergies: Synergy[];
  traitBonuses: Record<TraitId, number>;
}

/**
 * Simple string → 32-bit hash (FNV-1a variant).
 */
function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Seeded pseudo-random number generator based on a string seed.
 * Returns a function that yields numbers in [0, 1).
 */
function seededRandom(seed: string): () => number {
  let state = hashString(seed);
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    state = state >>> 0;
    return state / 0x100000000;
  };
}

/**
 * Check whether the "caotico" synergy condition is met:
 * Among non-zero element levels, the maximum must exceed 3× the minimum.
 */
function isCaoticoActive(elementLevels: ElementLevels): boolean {
  const nonZero = ELEMENTS.map((e) => elementLevels[e]).filter((v) => v > 0);
  if (nonZero.length < 2) return false;
  const max = Math.max(...nonZero);
  const min = Math.min(...nonZero);
  return max > 3 * min;
}

/**
 * Check whether the "organico" synergy's extra variance condition is met.
 * All three elements must be > 8 AND the variance among them must be < 3.
 */
function isOrganicoActive(elementLevels: ElementLevels): boolean {
  const values = (['C', 'N', 'O'] as const).map((e) => elementLevels[e]);
  if (values.some((v) => v <= 8)) return false;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return variance < 3;
}

/**
 * Evaluate all synergies for the current element levels and return
 * active synergies together with their aggregated trait bonuses.
 */
export function calculateSynergies(
  elementLevels: ElementLevels,
  creatureId: string,
  day: number,
): SynergyResult {
  const activeSynergies: Synergy[] = [];
  const traitBonuses = {} as Record<TraitId, number>;

  // Initialise bonuses to zero
  for (const t of TRAITS) {
    traitBonuses[t] = 0;
  }

  for (const synergy of SYNERGIES) {
    let active = false;

    if (synergy.id === 'caotico') {
      active = isCaoticoActive(elementLevels);
    } else if (synergy.id === 'organico') {
      active = isOrganicoActive(elementLevels);
    } else {
      // Standard threshold check
      active = synergy.elements.every(
        (el) => elementLevels[el] >= (synergy.thresholds[el] ?? 0),
      );
    }

    if (!active) continue;

    activeSynergies.push(synergy);

    if (synergy.id === 'caotico') {
      // Pick a random trait using seeded RNG
      const rng = seededRandom(`${creatureId}:${day}`);
      const idx = Math.floor(rng() * TRAITS.length);
      const chosenTrait = TRAITS[idx];
      traitBonuses[chosenTrait] += 0.5;
    } else {
      for (const trait of TRAITS) {
        const bonus = synergy.effects[trait];
        if (bonus !== undefined) {
          traitBonuses[trait] += bonus;
        }
      }
    }
  }

  return { activeSynergies, traitBonuses };
}
