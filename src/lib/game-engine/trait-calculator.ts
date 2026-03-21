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
  currentTraits: TraitValues,
  ageDays: number,
  stability: number,
  allocation?: Partial<Record<ElementId, number>>,
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

  // Use current injection credits (not accumulated levels) for growth calculation.
  // This keeps growth proportional to daily input, not snowballing with accumulated totals.
  // Add a small base from accumulated levels (10%) for flavor.
  const credits = allocation ?? {};

  for (const trait of TRAITS) {
    let creditSum = 0;
    let levelSum = 0;
    for (const el of ELEMENTS) {
      creditSum += (credits[el] ?? 0) * ELEMENT_TRAIT_WEIGHTS[el][trait];
      levelSum += elementLevels[el] * ELEMENT_TRAIT_WEIGHTS[el][trait];
    }
    // Main growth from credits, small boost from accumulated levels
    const rawDelta = (creditSum * 3 + levelSum * 0.02) * growthRate * stabilityModifier;

    // Diminishing returns: traits grow slower as they approach 100
    const currentValue = currentTraits[trait] ?? 0;
    const diminishing = 1 - (currentValue / 100) * 0.6;

    deltas[trait] = rawDelta * Math.max(diminishing, 0.1);
  }

  return deltas;
}
