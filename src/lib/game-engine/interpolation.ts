// ---------------------------------------------------------------------------
// Mutagenix – Gradual Mutation Interpolation
// ---------------------------------------------------------------------------
// Computes the visible state of a creature mid-mutation by interpolating
// between its "before" state and the mutation target state.

import type { ElementLevels, TraitValues } from '@/types/game';
import { mapTraitsToVisuals, type VisualParams } from './visual-mapper';
import { ELEMENTS, TRAITS, MUTATION_PHASES, type MutationPhase } from './constants';
import type { Creature } from '@/lib/db/schema/creatures';

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

/** Smooth ease-in-out cubic for organic-feeling interpolation. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface InterpolatedState {
  elementLevels: ElementLevels;
  traitValues: TraitValues;
  visualParams: VisualParams;
  stability: number;

  /** 0-1 progress through the mutation. */
  progress: number;
  /** Whether a mutation is actively in progress. */
  mutationActive: boolean;
  /** Current mutation phase name, or null when idle. */
  mutationPhase: MutationPhase | null;
}

// ---------------------------------------------------------------------------
// Numeric interpolation helpers
// ---------------------------------------------------------------------------

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate VisualParams, treating every numeric field with eased `t`
 * and preserving non-numeric fields from the target when `t >= 1`, else
 * from the current state.
 */
function interpolateVisualParams(
  current: VisualParams,
  target: VisualParams,
  easedT: number,
): VisualParams {
  const result: Record<string, unknown> = {};

  // Build the union of all keys from both states
  const allKeys = new Set([
    ...Object.keys(current),
    ...Object.keys(target),
  ]);

  for (const key of allKeys) {
    const cVal = (current as unknown as Record<string, unknown>)[key];
    const tVal = (target as unknown as Record<string, unknown>)[key];

    if (typeof cVal === 'number' && typeof tVal === 'number') {
      result[key] = lerpNum(cVal, tVal, easedT);
    } else if (Array.isArray(tVal)) {
      // Arrays (e.g. activeSynergyVisuals) — use target once past 50%
      result[key] = easedT >= 0.5 ? tVal : (cVal ?? tVal);
    } else if (typeof tVal === 'string') {
      // Strings (e.g. eyeColor) — snap to target at 50%
      result[key] = easedT >= 0.5 ? tVal : (cVal ?? tVal);
    } else {
      result[key] = tVal ?? cVal;
    }
  }

  return result as unknown as VisualParams;
}

// ---------------------------------------------------------------------------
// Current mutation phase
// ---------------------------------------------------------------------------

function getMutationPhase(progress: number): MutationPhase | null {
  for (const phase of MUTATION_PHASES) {
    if (progress >= phase.start && progress < phase.end) {
      return phase.name;
    }
  }
  // If progress is exactly 1.0, we're in the final phase
  if (progress >= 1) return 'stabilize';
  return null;
}

// ---------------------------------------------------------------------------
// Main interpolation function
// ---------------------------------------------------------------------------

/**
 * Compute the current visible state of a creature, interpolating between
 * its stored "current" state and its mutation target based on wall-clock time.
 *
 * If no mutation is active (no target state or mutation already expired),
 * the creature's current stored state is returned as-is.
 */
export function interpolateCreatureState(
  creature: Creature,
  now: Date = new Date(),
): InterpolatedState {
  const currentElementLevels = creature.elementLevels;
  const currentTraitValues = creature.traitValues;
  const currentStability = creature.stability ?? 0.5;

  // Always recalculate visual params with the current mapper to ensure consistency
  const freshVisualParams = mapTraitsToVisuals(
    currentTraitValues as TraitValues,
    currentElementLevels as ElementLevels,
    [],
  );

  // No active mutation — return current state with fresh visuals
  if (
    !creature.targetVisualParams ||
    !creature.targetElementLevels ||
    !creature.targetTraitValues ||
    !creature.mutationStartedAt ||
    !creature.mutationEndsAt
  ) {
    return {
      elementLevels: currentElementLevels,
      traitValues: currentTraitValues,
      visualParams: freshVisualParams,
      stability: currentStability,
      progress: 0,
      mutationActive: false,
      mutationPhase: null,
    };
  }

  const startMs = creature.mutationStartedAt.getTime();
  const endMs = creature.mutationEndsAt.getTime();
  const nowMs = now.getTime();
  const duration = endMs - startMs;

  // Avoid division by zero if duration is somehow 0
  if (duration <= 0) {
    return {
      elementLevels: creature.targetElementLevels,
      traitValues: creature.targetTraitValues,
      visualParams: creature.targetVisualParams as unknown as VisualParams,
      stability: currentStability,
      progress: 1,
      mutationActive: false,
      mutationPhase: null,
    };
  }

  // Raw linear progress clamped to [0, 1]
  const rawT = Math.max(0, Math.min(1, (nowMs - startMs) / duration));

  // Mutation complete — return target state
  if (rawT >= 1) {
    return {
      elementLevels: creature.targetElementLevels,
      traitValues: creature.targetTraitValues,
      visualParams: creature.targetVisualParams as unknown as VisualParams,
      stability: currentStability,
      progress: 1,
      mutationActive: false,
      mutationPhase: null,
    };
  }

  // Eased progress for traits & visuals (organic feel)
  const easedT = easeInOutCubic(rawT);

  // Interpolate element levels (linear — they represent chemical amounts)
  const interpElementLevels = {} as ElementLevels;
  for (const el of ELEMENTS) {
    interpElementLevels[el] = lerpNum(
      currentElementLevels[el],
      creature.targetElementLevels[el],
      rawT,
    );
  }

  // Interpolate trait values (eased — organic growth)
  const interpTraitValues = {} as TraitValues;
  for (const trait of TRAITS) {
    interpTraitValues[trait] = lerpNum(
      currentTraitValues[trait],
      creature.targetTraitValues[trait],
      easedT,
    );
  }

  // Interpolate visual params (eased)
  const interpVisualParams = interpolateVisualParams(
    currentVisualParams,
    creature.targetVisualParams as unknown as VisualParams,
    easedT,
  );

  // Interpolate stability linearly
  const targetStability = currentStability; // stability is recalculated at finalization
  const interpStability = lerpNum(currentStability, targetStability, rawT);

  return {
    elementLevels: interpElementLevels,
    traitValues: interpTraitValues,
    visualParams: interpVisualParams,
    stability: interpStability,
    progress: rawT,
    mutationActive: true,
    mutationPhase: getMutationPhase(rawT),
  };
}
