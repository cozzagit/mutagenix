// ---------------------------------------------------------------------------
// Mutagenix – Mutation Engine (daily orchestrator)
// ---------------------------------------------------------------------------

import {
  ELEMENTS,
  TRAITS,
  COMBAT_TRAITS,
  GAME_CONFIG,
  ELEMENT_COMBAT_WEIGHTS,
  type ElementId,
  type TraitId,
  type CombatTraitId,
} from './constants';

import type {
  ElementLevels,
  TraitValues,
  AllocationCredits,
  MutationEntry,
} from '@/types/game';

import type { VisualParams } from './visual-mapper';
import { calculateTraitDeltas } from './trait-calculator';
import { calculateSynergies } from './synergy-system';
import { calculateDecay } from './decay-system';
import { mapTraitsToVisuals } from './visual-mapper';
import { clamp } from './visual-mapper';

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

export interface MutationResult {
  newElementLevels: Record<ElementId, number>;
  newTraitValues: TraitValues;
  newVisualParams: VisualParams;
  newStability: number;
  mutations: MutationEntry[];
  activeSynergies: string[];
}

// ---------------------------------------------------------------------------
// Seeded PRNG
// ---------------------------------------------------------------------------

function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Returns a deterministic pseudo-random number generator seeded with the
 * given string. Each call to the returned function produces the next number
 * in the sequence, in the range [0, 1).
 */
export function seededRandom(seed: string): () => number {
  let state = hashString(seed);
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    state = state >>> 0;
    return state / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// Stability calculation
// ---------------------------------------------------------------------------

/**
 * Stability is inversely related to the variance among element levels.
 * A creature with evenly distributed elements is stable (→ 1);
 * highly skewed distributions are unstable (→ 0).
 */
function calculateStability(elementLevels: ElementLevels): number {
  const values = ELEMENTS.map((e) => elementLevels[e]);
  const nonZero = values.filter((v) => v > 0);
  if (nonZero.length <= 1) return 1;

  const mean = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  if (mean === 0) return 1;

  const variance =
    nonZero.reduce((sum, v) => sum + (v - mean) ** 2, 0) / nonZero.length;
  const cv = Math.sqrt(variance) / mean; // coefficient of variation

  // Map CV to stability: CV=0 → 1, CV≥2 → 0
  return clamp(1 - cv / 2, 0, 1);
}

// ---------------------------------------------------------------------------
// Main processing function
// ---------------------------------------------------------------------------

export interface CreatureInput {
  id: string;
  elementLevels: ElementLevels;
  traitValues: TraitValues;
  ageDays: number;
  stability: number;
  day: number;
}

/**
 * Process one day of mutation for a creature.
 *
 * 1. Apply allocation credits to element levels
 * 2. Recalculate stability
 * 3. Compute trait growth deltas
 * 4. Compute synergy bonuses
 * 5. Compute decay
 * 6. Apply seeded noise
 * 7. Clamp all traits
 * 8. Map traits to visual params
 * 9. Build mutation log
 */
export function processDailyMutation(
  creature: CreatureInput,
  allocation: AllocationCredits,
): MutationResult {
  const { id: creatureId, ageDays, day } = creature;

  // --- 1. Apply allocation to element levels ---
  const newElementLevels = { ...creature.elementLevels };
  for (const el of ELEMENTS) {
    const credits = allocation[el];
    if (credits !== undefined && credits > 0) {
      newElementLevels[el] += credits;
    }
  }

  // --- 2. Calculate stability ---
  const newStability = calculateStability(newElementLevels);

  // --- 2b. Calculate combat ratio (Warrior Phase) ---
  // Gradual transition: at WARRIOR_PHASE_START → 0%, at WARRIOR_PHASE_FULL → 90%
  const combatRatio = ageDays < GAME_CONFIG.WARRIOR_PHASE_START
    ? 0
    : clamp(
        (ageDays - GAME_CONFIG.WARRIOR_PHASE_START) /
        (GAME_CONFIG.WARRIOR_PHASE_FULL - GAME_CONFIG.WARRIOR_PHASE_START),
        0,
        0.9,
      );

  // --- 3. Trait growth deltas ---
  const growthDeltas = calculateTraitDeltas(
    newElementLevels,
    creature.traitValues,
    ageDays,
    newStability,
  );

  // --- 4. Synergy bonuses ---
  const { activeSynergies, traitBonuses } = calculateSynergies(
    newElementLevels,
    creatureId,
    day,
  );

  // --- 5. Decay ---
  const decayDeltas = calculateDecay(newElementLevels, creature.traitValues);

  // --- 6. Seeded noise ---
  const rng = seededRandom(`${creatureId}:noise:${day}`);
  const noiseDeltas = {} as Record<TraitId, number>;
  for (const trait of TRAITS) {
    // Noise range: ±NOISE_AMPLITUDE × current trait value (or ±1 minimum)
    const base = Math.max(creature.traitValues[trait], 1);
    noiseDeltas[trait] = (rng() * 2 - 1) * GAME_CONFIG.NOISE_AMPLITUDE * base;
  }

  // --- 7. Apply all deltas and clamp ---
  // Physical growth is reduced by combatRatio
  const physicalMultiplier = 1 - combatRatio;

  const mutations: MutationEntry[] = [];
  const newTraitValues = {} as TraitValues;

  for (const trait of TRAITS) {
    const oldValue = creature.traitValues[trait];

    const growthDelta = growthDeltas[trait] * physicalMultiplier;
    const synergyDelta = traitBonuses[trait];
    const decayDelta = decayDeltas[trait];
    const noiseDelta = noiseDeltas[trait];

    const totalDelta = growthDelta + synergyDelta + decayDelta + noiseDelta;
    const rawNew = oldValue + totalDelta;
    const clampedNew = clamp(
      rawNew,
      GAME_CONFIG.MIN_TRAIT_VALUE,
      GAME_CONFIG.MAX_TRAIT_VALUE,
    );

    newTraitValues[trait] = clampedNew;

    // Log individual contributions when they are non-negligible
    if (Math.abs(growthDelta) > 0.001) {
      mutations.push({
        traitId: trait,
        oldValue,
        newValue: clampedNew,
        delta: growthDelta,
        triggerType: 'growth',
      });
    }
    if (Math.abs(synergyDelta) > 0.001) {
      const synergyNames = activeSynergies.map((s) => s.name).join(', ');
      mutations.push({
        traitId: trait,
        oldValue,
        newValue: clampedNew,
        delta: synergyDelta,
        triggerType: 'synergy',
        triggerDetails: synergyNames,
      });
    }
    if (Math.abs(decayDelta) > 0.001) {
      mutations.push({
        traitId: trait,
        oldValue,
        newValue: clampedNew,
        delta: decayDelta,
        triggerType: 'decay',
      });
    }
    if (Math.abs(noiseDelta) > 0.001) {
      mutations.push({
        traitId: trait,
        oldValue,
        newValue: clampedNew,
        delta: noiseDelta,
        triggerType: 'noise',
      });
    }
  }

  // --- 7b. Combat trait growth (Warrior Phase) ---
  // Combat traits grow using: sum(elementLevel × combatWeight) × combatRatio × growthRate
  if (combatRatio > 0) {
    const growthRate = GAME_CONFIG.GROWTH_RATE_BASE / (1 + ageDays * 0.01);

    let stabilityModifier = 1;
    if (newStability < GAME_CONFIG.STABILITY_THRESHOLD_LOW) {
      stabilityModifier = 1.5;
    } else if (newStability > GAME_CONFIG.STABILITY_THRESHOLD_HIGH) {
      stabilityModifier = 0.7;
    }

    for (const combatTrait of COMBAT_TRAITS) {
      const oldValue = creature.traitValues[combatTrait] ?? 0;

      // Weighted sum of element contributions
      let weightedSum = 0;
      for (const el of ELEMENTS) {
        weightedSum += newElementLevels[el] * ELEMENT_COMBAT_WEIGHTS[el][combatTrait];
      }

      const combatDelta = weightedSum * combatRatio * growthRate * stabilityModifier;

      // battleScars always gets a tiny bonus with every injection (experience)
      const scarBonus = combatTrait === 'battleScars' ? 0.15 : 0;

      const totalCombatDelta = combatDelta + scarBonus;
      const rawNew = oldValue + totalCombatDelta;
      const clampedNew = clamp(rawNew, GAME_CONFIG.MIN_TRAIT_VALUE, GAME_CONFIG.MAX_TRAIT_VALUE);

      newTraitValues[combatTrait] = clampedNew;

      if (Math.abs(totalCombatDelta) > 0.001) {
        mutations.push({
          traitId: combatTrait,
          oldValue,
          newValue: clampedNew,
          delta: totalCombatDelta,
          triggerType: 'combat',
        });
      }
    }
  } else {
    // Before warrior phase, carry forward existing combat trait values (all 0 initially)
    for (const combatTrait of COMBAT_TRAITS) {
      newTraitValues[combatTrait] = creature.traitValues[combatTrait] ?? 0;
    }
  }

  // --- 8. Map to visuals ---
  const newVisualParams = mapTraitsToVisuals(
    newTraitValues,
    newElementLevels,
    activeSynergies,
  );

  // --- 9. Return ---
  return {
    newElementLevels,
    newTraitValues,
    newVisualParams,
    newStability,
    mutations,
    activeSynergies: activeSynergies.map((s) => s.id),
  };
}
