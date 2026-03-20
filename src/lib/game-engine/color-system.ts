// ---------------------------------------------------------------------------
// Mutagenix – Color System
// ---------------------------------------------------------------------------
// Generates CONTRASTING, stravagant creature color palettes based on
// element composition and trait values.
//
// The key principle: body parts (fur, spines, eyes, claws, tail, glow)
// should NOT share the body's color. They should CONTRAST with it,
// creating visually striking and unique creatures.
// ---------------------------------------------------------------------------

import type { ElementId } from './constants';
import { ELEMENTS } from './constants';
import type { ElementLevels, TraitValues } from '@/types/game';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreatureColorPalette {
  // Body colors
  bodyPrimary: string;
  bodySecondary: string;
  bodyAccent: string;

  // Feature colors (CONTRASTING with body)
  furColor: string;
  spineColor: string;
  clawColor: string;
  eyeIrisColor: string;
  eyeScleraColor: string;
  tailColor: string;

  // Effects
  glowColor: string;
  veinColor: string;
  mouthColor: string;
  toothColor: string;

  // Pattern
  patternType: 'none' | 'spots' | 'stripes' | 'patches' | 'gradient';
  patternColor: string;
  patternOpacity: number;

  // Derived numeric values for VisualParams compatibility
  bodySecondaryHue: number;
  bodySecondaryLightness: number;
}

// ---------------------------------------------------------------------------
// Element hue associations
// ---------------------------------------------------------------------------

const ELEMENT_HUE: Record<ElementId, number> = {
  N:  210,  // deep blue
  K:  270,  // electric purple
  Na: 35,   // warm orange
  C:  0,    // neutral/gray (low saturation)
  O:  190,  // cyan
  P:  140,  // toxic green
  S:  55,   // acid yellow
  Ca: 40,   // bone cream
  Fe: 5,    // blood red
  Cl: 95,   // lime green
};

/** Base saturation per element — some elements are vivid, others muted */
const ELEMENT_SATURATION: Record<ElementId, number> = {
  N:  55,   // moderate blue
  K:  75,   // vivid purple
  Na: 65,   // warm orange
  C:  12,   // very muted gray
  O:  50,   // moderate cyan
  P:  70,   // vivid toxic green
  S:  80,   // vivid acid yellow
  Ca: 25,   // muted cream
  Fe: 75,   // vivid blood red
  Cl: 60,   // moderate lime
};

/** Base lightness per element */
const ELEMENT_LIGHTNESS: Record<ElementId, number> = {
  N:  30,   // dark blue
  K:  28,   // dark purple
  Na: 38,   // moderate orange
  C:  25,   // dark neutral
  O:  35,   // moderate cyan
  P:  32,   // moderate green
  S:  40,   // brighter yellow
  Ca: 55,   // light cream
  Fe: 22,   // dark blood red
  Cl: 35,   // moderate lime
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an HSL color string. */
export function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(((h % 360) + 360) % 360)}, ${Math.round(clamp(s, 0, 100))}%, ${Math.round(clamp(l, 0, 100))}%)`;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/** Angular distance between two hues (0-180). */
function hueDist(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
}

/** Complementary hue (180 degrees away). */
function complementary(h: number): number {
  return (h + 180) % 360;
}

/** Shift hue toward a target by a fraction t (0-1). */
function shiftHue(from: number, toward: number, t: number): number {
  // Find shortest arc direction
  let diff = ((toward - from) % 360 + 360) % 360;
  if (diff > 180) diff -= 360;
  return ((from + diff * t) % 360 + 360) % 360;
}

/** Blend two hues, weighted by their respective strengths. */
function blendHues(h1: number, w1: number, h2: number, w2: number): number {
  const total = w1 + w2;
  if (total === 0) return h1;
  return shiftHue(h1, h2, w2 / total);
}

// ---------------------------------------------------------------------------
// Ranked elements
// ---------------------------------------------------------------------------

interface RankedElement {
  id: ElementId;
  level: number;
  hue: number;
  saturation: number;
  lightness: number;
}

/**
 * Rank elements by level descending. Returns at least 3 entries
 * (padding with neutral fallback if fewer exist).
 */
function rankElements(elementLevels: ElementLevels): RankedElement[] {
  const ranked: RankedElement[] = ELEMENTS
    .map((id) => ({
      id,
      level: elementLevels[id] ?? 0,
      hue: ELEMENT_HUE[id],
      saturation: ELEMENT_SATURATION[id],
      lightness: ELEMENT_LIGHTNESS[id],
    }))
    .sort((a, b) => b.level - a.level);

  // Ensure at least 3 entries with non-zero data
  while (ranked.length < 3) {
    ranked.push({ id: 'C' as ElementId, level: 0, hue: 0, saturation: 12, lightness: 25 });
  }

  return ranked;
}

// ---------------------------------------------------------------------------
// Pattern determination
// ---------------------------------------------------------------------------

function determinePattern(
  ranked: RankedElement[],
): { type: CreatureColorPalette['patternType']; opacity: number } {
  const top1 = ranked[0];
  const top2 = ranked[1];
  const top3 = ranked[2];
  const totalTop3 = top1.level + top2.level + top3.level;

  if (totalTop3 === 0) {
    return { type: 'none', opacity: 0 };
  }

  const dominance = top1.level / totalTop3;
  const dist12 = hueDist(top1.hue, top2.hue);

  // One element overwhelmingly dominant => gradient (monochromatic shifts)
  if (dominance > 0.6) {
    return { type: 'gradient', opacity: 0.15 + dominance * 0.1 };
  }

  // Three roughly equal elements => patches
  const balance = Math.min(top1.level, top2.level, top3.level) / Math.max(top1.level, 1);
  if (balance > 0.5 && top3.level > 5) {
    return { type: 'patches', opacity: 0.2 + balance * 0.1 };
  }

  // Top two very different in hue => spots
  if (dist12 > 90) {
    return { type: 'spots', opacity: 0.15 + (dist12 / 180) * 0.15 };
  }

  // Top two similar in hue => stripes
  if (dist12 < 45) {
    return { type: 'stripes', opacity: 0.12 + (1 - dist12 / 45) * 0.12 };
  }

  // Default: spots with moderate opacity
  return { type: 'spots', opacity: 0.15 };
}

// ---------------------------------------------------------------------------
// Stability warp
// ---------------------------------------------------------------------------

/**
 * Apply instability effects to colors.
 * - stability < 0.3: colors shift unpredictably, saturation cranked up
 * - stability > 0.8: colors become more harmonious (less contrast)
 */
function applyStabilityWarp(
  h: number,
  s: number,
  l: number,
  stability: number,
  seed: number,
): { h: number; s: number; l: number } {
  if (stability < 0.3) {
    // Unstable: hue jitters, saturation spikes
    const instability = (0.3 - stability) / 0.3; // 0-1 where 1 = maximally unstable
    const hueShift = Math.sin(seed * 7.31) * 40 * instability;
    const satBoost = instability * 25;
    const lightShift = Math.cos(seed * 3.17) * 10 * instability;
    return {
      h: h + hueShift,
      s: clamp(s + satBoost, 0, 100),
      l: clamp(l + lightShift, 5, 85),
    };
  }

  if (stability > 0.8) {
    // Very stable: shift all hues slightly toward body hue (more harmonious)
    // This is handled by the caller by reducing contrast
    const harmony = (stability - 0.8) / 0.2; // 0-1
    return {
      h,
      s: clamp(s - harmony * 10, 0, 100),
      l,
    };
  }

  return { h, s, l };
}

// ---------------------------------------------------------------------------
// Main palette generator
// ---------------------------------------------------------------------------

/**
 * Generate a contrasting, stravagant color palette for a creature.
 *
 * @param elementLevels - Current element concentrations (Record<ElementId, number>)
 * @param traitValues   - Current trait values (Record<TraitId, number>)
 * @param stability     - Creature stability (0-1, lower = more chaotic)
 */
export function generateColorPalette(
  elementLevels: ElementLevels,
  traitValues: TraitValues,
  stability: number,
): CreatureColorPalette {
  const ranked = rankElements(elementLevels);
  const el1 = ranked[0]; // dominant
  const el2 = ranked[1]; // secondary
  const el3 = ranked[2]; // tertiary

  const totalLevel = ranked.reduce((sum, r) => sum + r.level, 0);
  const concentration = totalLevel > 0 ? el1.level / totalLevel : 0;

  // Seed for deterministic pseudo-random effects from stability warp
  const warpSeed = el1.level * 3.7 + el2.level * 7.1 + el3.level * 11.3;

  // ===========================================================================
  // BODY PRIMARY — from #1 dominant element
  // ===========================================================================
  const bodyHue = el1.hue;
  const bodySat = clamp(el1.saturation + concentration * 20, 15, 90);
  const bodyLit = clamp(el1.lightness, 12, 50);

  const bodyW = applyStabilityWarp(bodyHue, bodySat, bodyLit, stability, warpSeed);
  const bodyPrimary = hsl(bodyW.h, bodyW.s, bodyW.l);

  // ===========================================================================
  // BODY SECONDARY (belly/inner) — analogous or complementary shift from body
  // ===========================================================================
  const secondaryShift = concentration > 0.5 ? 30 : 45; // more dominant = closer hue
  const bodySecHue = bodyHue + secondaryShift;
  const bodySecSat = clamp(bodySat - 10, 10, 70);
  const bodySecLit = clamp(bodyLit + 18, 25, 65);
  const bodySecW = applyStabilityWarp(bodySecHue, bodySecSat, bodySecLit, stability, warpSeed + 1);
  const bodySecondary = hsl(bodySecW.h, bodySecW.s, bodySecW.l);

  // ===========================================================================
  // BODY ACCENT — spots/highlights, triadic relationship
  // ===========================================================================
  const accentHue = bodyHue + 120; // triadic
  const accentSat = clamp(bodySat + 10, 30, 85);
  const accentLit = clamp(bodyLit + 10, 25, 60);
  const bodyAccent = hsl(accentHue, accentSat, accentLit);

  // ===========================================================================
  // FUR COLOR — from #2 element (CONTRASTING with body!)
  // ===========================================================================
  // A creature with Fe body (red) and P secondary (green) gets GREEN fur on RED body
  const furHue = el2.hue;
  const furSat = clamp(el2.saturation + 5, 20, 80);
  const furLit = clamp(el2.lightness + 12, 25, 65);
  const furW = applyStabilityWarp(furHue, furSat, furLit, stability, warpSeed + 2);
  const furColor = hsl(furW.h, furW.s, furW.l);

  // ===========================================================================
  // SPINE/HORN COLOR — from #3 element, or complementary of body if not enough variety
  // ===========================================================================
  let spineHue: number;
  let spineSat: number;
  let spineLit: number;

  if (el3.level > 3 && hueDist(el3.hue, bodyHue) > 30) {
    // Third element has enough presence and is distinct
    spineHue = el3.hue;
    spineSat = clamp(el3.saturation + 10, 25, 85);
    spineLit = clamp(el3.lightness + 5, 20, 60);
  } else {
    // Fall back to complementary of body
    spineHue = complementary(bodyHue);
    spineSat = clamp(bodySat + 15, 30, 85);
    spineLit = clamp(bodyLit - 5, 15, 50);
  }
  const spineW = applyStabilityWarp(spineHue, spineSat, spineLit, stability, warpSeed + 3);
  const spineColor = hsl(spineW.h, spineW.s, spineW.l);

  // ===========================================================================
  // CLAW COLOR — bone-like base, tinted by #3 element or aggression
  // ===========================================================================
  const aggression = (traitValues.aggression ?? 0) / 100;
  const clawBaseHue = el3.level > 2 ? el3.hue : 40; // bone cream fallback
  const clawSat = clamp(20 + aggression * 30, 15, 55);
  const clawLit = clamp(70 - aggression * 25, 35, 80);
  const clawColor = hsl(clawBaseHue, clawSat, clawLit);

  // ===========================================================================
  // EYE IRIS — always vivid! Picks the element contributing most to eyeDev
  // (K and P are typical eye-developers), or complementary of body
  // ===========================================================================
  // Find which element contributes most to eye development
  // K (eyeDev 0.3), P (eyeDev 0.3), Na (eyeDev 0.2), O (eyeDev 0.1), Fe (eyeDev 0.1)
  const eyeContributors = ([
    { id: 'K' as ElementId, score: elementLevels.K * 0.3 },
    { id: 'P' as ElementId, score: elementLevels.P * 0.3 },
    { id: 'Na' as ElementId, score: elementLevels.Na * 0.2 },
    { id: 'O' as ElementId, score: elementLevels.O * 0.1 },
    { id: 'Fe' as ElementId, score: elementLevels.Fe * 0.1 },
  ]).sort((a, b) => b.score - a.score);

  let eyeHue: number;
  if (eyeContributors[0].score > 2) {
    eyeHue = ELEMENT_HUE[eyeContributors[0].id];
  } else {
    eyeHue = complementary(bodyHue);
  }
  const eyeSat = clamp(75 + (traitValues.luminosity ?? 0) * 0.15, 60, 100);
  const eyeLit = clamp(50 + (traitValues.intelligence ?? 0) * 0.12, 40, 70);
  const eyeW = applyStabilityWarp(eyeHue, eyeSat, eyeLit, stability, warpSeed + 4);
  const eyeIrisColor = hsl(eyeW.h, eyeW.s, eyeW.l);

  // Eye sclera — very slightly tinted by body hue
  const eyeScleraColor = hsl(bodyHue, 8, 87);

  // ===========================================================================
  // TAIL COLOR — gradient from body to secondary element
  // ===========================================================================
  const tailHue = blendHues(bodyHue, 0.4, el2.hue, 0.6);
  const tailSat = clamp(bodySat + 5, 20, 75);
  const tailLit = clamp(bodyLit + 5, 20, 55);
  const tailColor = hsl(tailHue, tailSat, tailLit);

  // ===========================================================================
  // GLOW COLOR — from the element with highest luminosity contribution
  // P (0.4), K (0.2), Na (0.2), O (0.2)
  // ===========================================================================
  const glowContributors = ([
    { id: 'P' as ElementId, score: elementLevels.P * 0.4 },
    { id: 'K' as ElementId, score: elementLevels.K * 0.2 },
    { id: 'Na' as ElementId, score: elementLevels.Na * 0.2 },
    { id: 'O' as ElementId, score: elementLevels.O * 0.2 },
  ]).sort((a, b) => b.score - a.score);

  let glowHue: number;
  if (glowContributors[0].score > 1) {
    glowHue = ELEMENT_HUE[glowContributors[0].id];
  } else {
    glowHue = bodyHue;
  }
  const glowSat = clamp(70 + (traitValues.luminosity ?? 0) * 0.2, 50, 100);
  const glowLit = clamp(55 + (traitValues.luminosity ?? 0) * 0.1, 45, 75);
  const glowW = applyStabilityWarp(glowHue, glowSat, glowLit, stability, warpSeed + 5);
  const glowColor = hsl(glowW.h, glowW.s, glowW.l);

  // ===========================================================================
  // VEIN COLOR — body hue shifted toward red
  // ===========================================================================
  const veinHue = shiftHue(bodyHue, 5, 0.6); // shift 60% toward blood red
  const veinSat = clamp(bodySat + 20, 40, 85);
  const veinLit = clamp(bodyLit - 5, 15, 40);
  const veinColor = hsl(veinHue, veinSat, veinLit);

  // ===========================================================================
  // MOUTH — always dark crimson
  // ===========================================================================
  const mouthColor = hsl(350, 60, 25);

  // ===========================================================================
  // TEETH — bone white, yellowing with aggression
  // ===========================================================================
  const toothHue = 40 + aggression * 10; // shifts toward amber
  const toothSat = 30 + aggression * 25;
  const toothLit = 85 - aggression * 20;
  const toothColor = hsl(toothHue, toothSat, toothLit);

  // ===========================================================================
  // PATTERN
  // ===========================================================================
  const { type: patternType, opacity: basePatternOpacity } = determinePattern(ranked);

  // Pattern color is a blend of #2 and #3 element hues
  const patternHue = blendHues(el2.hue, el2.level, el3.hue, el3.level);
  const patternSat = clamp((el2.saturation + el3.saturation) / 2 + 10, 20, 75);
  const patternLit = clamp((el2.lightness + el3.lightness) / 2, 20, 55);
  const patternColor = hsl(patternHue, patternSat, patternLit);
  const patternOpacity = clamp(basePatternOpacity, 0, 0.4);

  return {
    bodyPrimary,
    bodySecondary,
    bodyAccent,

    furColor,
    spineColor,
    clawColor,
    eyeIrisColor,
    eyeScleraColor,
    tailColor,

    glowColor,
    veinColor,
    mouthColor,
    toothColor,

    patternType,
    patternColor,
    patternOpacity,

    bodySecondaryHue: ((bodySecW.h % 360) + 360) % 360,
    bodySecondaryLightness: bodySecW.l,
  };
}

// ---------------------------------------------------------------------------
// Default palette (for a brand new blob with no elements)
// ---------------------------------------------------------------------------

export const DEFAULT_COLOR_PALETTE: CreatureColorPalette = {
  bodyPrimary: 'hsl(210, 15%, 25%)',
  bodySecondary: 'hsl(240, 10%, 43%)',
  bodyAccent: 'hsl(330, 25%, 35%)',

  furColor: 'hsl(210, 20%, 40%)',
  spineColor: 'hsl(30, 30%, 35%)',
  clawColor: 'hsl(40, 20%, 70%)',
  eyeIrisColor: 'hsl(210, 60%, 50%)',
  eyeScleraColor: 'hsl(210, 8%, 87%)',
  tailColor: 'hsl(210, 18%, 30%)',

  glowColor: 'hsl(210, 70%, 55%)',
  veinColor: 'hsl(5, 40%, 20%)',
  mouthColor: 'hsl(350, 60%, 25%)',
  toothColor: 'hsl(40, 30%, 85%)',

  patternType: 'none',
  patternColor: 'hsl(210, 15%, 30%)',
  patternOpacity: 0,

  bodySecondaryHue: 240,
  bodySecondaryLightness: 43,
};
