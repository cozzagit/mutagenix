// ---------------------------------------------------------------------------
// Mutagenix – Trait Decay System
// ---------------------------------------------------------------------------

import {
  ELEMENTS,
  TRAITS,
  ELEMENT_TRAIT_WEIGHTS,
  GAME_CONFIG,
  type TraitId,
} from './constants';

import type { ElementLevels, TraitValues } from '@/types/game';

/**
 * Calculate decay deltas for every trait.
 *
 * Traits that are no longer "supported" by sufficient element levels
 * gradually regress toward zero.
 *
 * Support for a trait = Σ (elementLevel[e] × weight[e][trait]).
 * When support < 1.0:
 *   decayDelta = −DECAY_RATE × currentTraitValue × (1 − support)
 *
 * All returned values are ≤ 0.
 */
export function calculateDecay(
  elementLevels: ElementLevels,
  currentTraits: TraitValues,
): Record<TraitId, number> {
  const deltas = {} as Record<TraitId, number>;

  for (const trait of TRAITS) {
    let support = 0;
    for (const el of ELEMENTS) {
      support += elementLevels[el] * ELEMENT_TRAIT_WEIGHTS[el][trait];
    }

    if (support < 1.0) {
      deltas[trait] =
        -GAME_CONFIG.DECAY_RATE * currentTraits[trait] * (1 - support);
    } else {
      deltas[trait] = 0;
    }
  }

  return deltas;
}
