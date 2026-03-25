// ---------------------------------------------------------------------------
// Mutagenix – Genetic Imprint System (Impronta Genetica)
// ---------------------------------------------------------------------------
// PURE function module: no DB, no side effects.
//
// Each creature has per-element efficiency coefficients determined at birth.
// Elements dominant at birth → coefficient > 1 (injections more effective).
// Elements weak at birth → coefficient < 1 (injections less effective).
// No initial stat advantage — differences only emerge over time.
// ---------------------------------------------------------------------------

import { ELEMENTS, type ElementId } from './constants';

export type GeneticImprint = Record<ElementId, number>; // coefficients 0.7 to 1.3

/**
 * Calculate genetic imprint from founding elements.
 * Elements with higher founding proportion get higher efficiency coefficient.
 * Coefficients are normalized so the average is 1.0.
 * Range: [0.7, 1.3]
 */
export function calculateGeneticImprint(
  foundingElements: Record<string, number> | null,
): GeneticImprint {
  const imprint = {} as GeneticImprint;

  if (!foundingElements) {
    // No founding data (Gen 1 creatures born before this system) — neutral imprint
    for (const el of ELEMENTS) {
      imprint[el] = 1.0;
    }
    return imprint;
  }

  const total = ELEMENTS.reduce((sum, el) => sum + (foundingElements[el] ?? 0), 0);

  if (total <= 0) {
    for (const el of ELEMENTS) imprint[el] = 1.0;
    return imprint;
  }

  // Calculate raw proportions
  const proportions: Record<string, number> = {};
  for (const el of ELEMENTS) {
    proportions[el] = (foundingElements[el] ?? 0) / total;
  }

  // Average proportion = 1/10 = 0.1 for 10 elements
  const avgProportion = 1 / ELEMENTS.length;

  // Map proportion to coefficient:
  // proportion == avgProportion → coefficient = 1.0
  // proportion == 0 → coefficient = 0.7
  // proportion == 2*avgProportion → coefficient = 1.3
  // Use linear interpolation with clamp
  for (const el of ELEMENTS) {
    const ratio = proportions[el] / avgProportion; // 0 to ~2+
    const raw = 0.7 + ratio * 0.3; // maps 0→0.7, 1→1.0, 2→1.3
    imprint[el] = Math.max(0.7, Math.min(1.3, raw));
  }

  // Normalize so average coefficient is exactly 1.0
  const coeffSum = ELEMENTS.reduce((sum, el) => sum + imprint[el], 0);
  const coeffAvg = coeffSum / ELEMENTS.length;
  if (coeffAvg > 0) {
    for (const el of ELEMENTS) {
      imprint[el] = Math.max(0.7, Math.min(1.3, imprint[el] / coeffAvg));
    }
  }

  return imprint;
}

/**
 * For offspring: blend two parents' imprints using the breeding ratio (65/35).
 */
export function blendGeneticImprints(
  imprintA: GeneticImprint, // partner parent (65%)
  imprintB: GeneticImprint, // own parent (35%)
): GeneticImprint {
  const result = {} as GeneticImprint;
  for (const el of ELEMENTS) {
    result[el] = Math.max(0.7, Math.min(1.3,
      imprintA[el] * 0.65 + imprintB[el] * 0.35
    ));
  }
  return result;
}
