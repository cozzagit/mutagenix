// ---------------------------------------------------------------------------
// Mutagenix – Genetics Engine (breeding offspring calculator)
// ---------------------------------------------------------------------------
// PURE function module: no DB, no side effects, uses seeded PRNG.
// ---------------------------------------------------------------------------

import {
  ELEMENTS,
  TRAITS,
  COMBAT_TRAITS,
  type ElementId,
  type TraitId,
  type CombatTraitId,
} from './constants';

import { BREEDING_CONFIG } from './breeding-config';

// ---------------------------------------------------------------------------
// Seeded PRNG (same pattern as mutation-engine.ts)
// ---------------------------------------------------------------------------

function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BreedingParent {
  id: string;
  elementLevels: Record<string, number>;
  traitValues: Record<string, number>;
  stability: number;
  foundingElements: Record<string, number> | null;
  growthElements: Record<string, number> | null;
  ageDays: number;
  familyGeneration: number;
}

export interface OffspringResult {
  elementLevels: Record<string, number>;
  traitValues: Record<string, number>;
  stability: number;
  foundingElements: Record<string, number>;
  growthElements: Record<string, number> | null;
  familyGeneration: number;
}

export interface BreedingResult {
  offspringA: OffspringResult; // for player A (65% from parentB)
  offspringB: OffspringResult; // for player B (65% from parentA)
  anomalies: string[];         // description of genetic anomalies that occurred
}

// ---------------------------------------------------------------------------
// Helper: clamp value to range
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Internal: calculate one offspring
// ---------------------------------------------------------------------------

/**
 * Calculate a single offspring's stats.
 * The "dominant" parent contributes 65%, the "recessive" parent 35%.
 */
function calculateSingleOffspring(
  dominant: BreedingParent,
  recessive: BreedingParent,
  rng: () => number,
  anomalies: string[],
  offspringLabel: string,
): OffspringResult {
  const {
    INHERITANCE_RATIO_PARTNER: DOMINANT_RATIO,
    INHERITANCE_RATIO_OWN: RECESSIVE_RATIO,
    ELEMENT_SCALE_FACTOR,
    TRAIT_SCALE_FACTOR,
    ANOMALY_CHANCE,
    MILD_ANOMALY_CHANCE,
    MAJOR_ANOMALY_CHANCE,
  } = BREEDING_CONFIG;

  // --- Element Levels ---
  const elementLevels: Record<string, number> = {};
  for (const el of ELEMENTS) {
    const blended =
      (dominant.elementLevels[el] ?? 0) * DOMINANT_RATIO +
      (recessive.elementLevels[el] ?? 0) * RECESSIVE_RATIO;

    // Scale to ELEMENT_SCALE_FACTOR (offspring start young)
    let value = blended * ELEMENT_SCALE_FACTOR;

    // Noise: ±5% of blended value
    const noise = (rng() * 2 - 1) * 0.05 * blended;
    value += noise;

    elementLevels[el] = Math.max(0, value);
  }

  // --- Physical Trait Values ---
  const traitValues: Record<string, number> = {};
  for (const trait of TRAITS) {
    const blended =
      (dominant.traitValues[trait] ?? 0) * DOMINANT_RATIO +
      (recessive.traitValues[trait] ?? 0) * RECESSIVE_RATIO;

    // Scale to TRAIT_SCALE_FACTOR (offspring are young, traits develop with injections)
    let value = blended * TRAIT_SCALE_FACTOR;

    // Noise: ±10% of blended value
    const noise = (rng() * 2 - 1) * 0.10 * blended;
    value += noise;

    traitValues[trait] = Math.max(0, value);
  }

  // --- Combat Traits: ALL start at 0 (must be earned through warrior phase) ---
  for (const combatTrait of COMBAT_TRAITS) {
    traitValues[combatTrait] = 0;
  }

  // --- Founding Elements (inherited blend, NOT scaled) ---
  const foundingElements: Record<string, number> = {};
  const dominantFounding = dominant.foundingElements ?? dominant.elementLevels;
  const recessiveFounding = recessive.foundingElements ?? recessive.elementLevels;
  for (const el of ELEMENTS) {
    foundingElements[el] =
      (dominantFounding[el] ?? 0) * DOMINANT_RATIO +
      (recessiveFounding[el] ?? 0) * RECESSIVE_RATIO;
  }

  // --- Growth Elements: null (offspring hasn't had growth phase yet) ---
  const growthElements: Record<string, number> | null = null;

  // --- Stability ---
  let stability = 0.5;
  if (dominant.stability > 0.7 && recessive.stability > 0.7) {
    stability = 0.55; // genetic stability bonus
  } else if (dominant.stability < 0.3 && recessive.stability < 0.3) {
    stability = 0.40; // genetic instability penalty
  }

  // --- Family Generation ---
  const familyGeneration =
    Math.max(dominant.familyGeneration, recessive.familyGeneration) + 1;

  // --- Genetic Anomalies (per physical trait, 15% chance) ---
  for (const trait of TRAITS) {
    if (rng() < ANOMALY_CHANCE) {
      const roll = rng();

      if (roll < MAJOR_ANOMALY_CHANCE / ANOMALY_CHANCE) {
        // Major anomaly: trait += random [-15, +15]
        const shift = (rng() * 2 - 1) * 15;
        const oldVal = traitValues[trait];
        traitValues[trait] = Math.max(0, traitValues[trait] + shift);
        anomalies.push(
          `${offspringLabel}: Anomalia genetica maggiore su ${trait} — ` +
          `spostamento di ${shift > 0 ? '+' : ''}${shift.toFixed(1)} ` +
          `(${oldVal.toFixed(1)} → ${traitValues[trait].toFixed(1)})`
        );
      } else {
        // Mild anomaly: trait *= random [0.8, 1.2]
        const factor = 0.8 + rng() * 0.4;
        const oldVal = traitValues[trait];
        traitValues[trait] = Math.max(0, traitValues[trait] * factor);
        anomalies.push(
          `${offspringLabel}: Anomalia genetica su ${trait} — ` +
          `fattore ${factor.toFixed(2)}x ` +
          `(${oldVal.toFixed(1)} → ${traitValues[trait].toFixed(1)})`
        );
      }
    }
  }

  return {
    elementLevels,
    traitValues,
    stability,
    foundingElements,
    growthElements,
    familyGeneration,
  };
}

// ---------------------------------------------------------------------------
// Main export: calculateOffspring
// ---------------------------------------------------------------------------

/**
 * Calculate the results of breeding two creatures.
 *
 * Each player receives an offspring that inherits 65% from the PARTNER's
 * creature and 35% from their own — incentivizing cross-breeding.
 *
 * @param parentA - Player A's creature
 * @param parentB - Player B's creature
 * @param seedString - Deterministic seed for reproducible results
 * @returns BreedingResult with both offspring and any anomalies
 */
export function calculateOffspring(
  parentA: BreedingParent,
  parentB: BreedingParent,
  seedString: string,
): BreedingResult {
  const anomalies: string[] = [];

  // Offspring A: for player A → 65% from parentB (partner), 35% from parentA (own)
  const rngA = seededRandom(`${seedString}:offspringA`);
  const offspringA = calculateSingleOffspring(
    parentB, parentA, rngA, anomalies, 'Figlio A',
  );

  // Offspring B: for player B → 65% from parentA (partner), 35% from parentB (own)
  const rngB = seededRandom(`${seedString}:offspringB`);
  const offspringB = calculateSingleOffspring(
    parentA, parentB, rngB, anomalies, 'Figlio B',
  );

  return { offspringA, offspringB, anomalies };
}
