// ---------------------------------------------------------------------------
// Mutagenix – Trait Delta Calculator
// ---------------------------------------------------------------------------

import {
  ELEMENTS,
  TRAITS,
  ELEMENT_TRAIT_WEIGHTS,
  GAME_CONFIG,
  type ElementId,
  type TraitId,
} from './constants';

import type { ElementLevels, TraitValues } from '@/types/game';

/**
 * Calculate how much each trait should change this tick based on current
 * element concentrations, creature age, and stability.
 *
 * Growth slows with age and is modulated by creature stability:
 *   - Unstable creatures (stability < 0.3) mutate faster  (×1.5)
 *   - Stable creatures   (stability > 0.7) mutate slower  (×0.7)
 */
export function calculateTraitDeltas(
  elementLevels: ElementLevels,
  _currentTraits: TraitValues,
  ageDays: number,
  stability: number,
): Record<TraitId, number> {
  const growthRate =
    GAME_CONFIG.GROWTH_RATE_BASE / (1 + ageDays * 0.01);

  let stabilityModifier = 1;
  if (stability < GAME_CONFIG.STABILITY_THRESHOLD_LOW) {
    stabilityModifier = 1.5;
  } else if (stability > GAME_CONFIG.STABILITY_THRESHOLD_HIGH) {
    stabilityModifier = 0.7;
  }

  const deltas = {} as Record<TraitId, number>;

  for (const trait of TRAITS) {
    let sum = 0;
    for (const el of ELEMENTS) {
      sum += elementLevels[el] * ELEMENT_TRAIT_WEIGHTS[el][trait];
    }
    deltas[trait] = sum * growthRate * stabilityModifier;
  }

  return deltas;
}
