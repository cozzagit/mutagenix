// ---------------------------------------------------------------------------
// Mutagenix – Visual Mapper
// ---------------------------------------------------------------------------

import {
  ELEMENTS,
  TRAITS,
  type ElementId,
  type TraitId,
  type Synergy,
} from './constants';

import type { ElementLevels, TraitValues } from '@/types/game';
import { generateColorPalette, type CreatureColorPalette } from './color-system';

// ---------------------------------------------------------------------------
// VisualParams
// ---------------------------------------------------------------------------

export interface VisualParams {
  // Body
  bodyWidth: number;
  bodyHeight: number;
  bodyBlobiness: number;
  bodyHue: number;
  bodySaturation: number;
  bodyLightness: number;
  bodyOpacity: number;

  // Head
  headSize: number;
  headYOffset: number;

  // Eyes
  eyeCount: number;
  eyeSize: number;
  eyeColor: string;
  eyeGlow: number;
  pupilShape: number;

  // Limbs
  limbCount: number;
  limbLength: number;
  limbThickness: number;
  limbCurve: number;

  // Details
  spineCount: number;
  spineLength: number;
  tailLength: number;
  tailCurve: number;
  clawSize: number;

  // Texture
  furDensity: number;
  skinRoughness: number;

  // Meta
  postureAngle: number;
  symmetry: number;
  glowIntensity: number;
  glowHue: number;

  // Personality-driven visuals
  aggressionLevel: number;    // 0-1, affects pose/expression
  luminosityLevel: number;    // 0-1, affects glow/bioluminescence
  toxicityLevel: number;      // 0-1, affects color tints/drips
  intelligenceLevel: number;  // 0-1, affects head/eye proportions
  armoringLevel: number;      // 0-1, affects skin thickness/plates

  // Color palette (contrasting feature colors from color-system)
  furColor: string;
  spineColor: string;
  clawColor: string;
  eyeIrisColor: string;
  tailColor: string;
  patternType: string;
  patternColor: string;
  patternOpacity: number;
  bodySecondaryHue: number;
  bodySecondaryLightness: number;
  mouthColor: string;
  toothColor: string;
  veinColor: string;
  glowColorFromPalette: string;

  // Synergy effects
  activeSynergyVisuals: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Linear interpolation from `min` to `max` with `t` in [0, 1]. */
export function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * clamp(t, 0, 1);
}

/** Clamp `val` between `min` and `max`. */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/**
 * Map a continuous value (0–100) to discrete steps.
 * `thresholds` is a sorted array of `[minValue, result]` pairs.
 * Returns the result of the highest threshold that `value` meets or exceeds.
 */
export function stepped(
  value: number,
  thresholds: readonly (readonly [number, number])[],
): number {
  let result = thresholds[0][1];
  for (const [min, res] of thresholds) {
    if (value >= min) {
      result = res;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Element → hue mapping
// ---------------------------------------------------------------------------

const ELEMENT_HUE: Record<ElementId, number> = {
  N: 200,   // blue
  K: 280,   // purple
  Na: 40,   // orange
  C: 0,     // neutral / red-ish
  O: 180,   // cyan
  P: 120,   // green
  S: 60,    // yellow
  Ca: 30,   // cream
  Fe: 0,    // red
  Cl: 100,  // lime
};

/**
 * Identify the element with the highest concentration.
 * In case of a tie the first element in ELEMENTS order wins.
 */
function dominantElement(elementLevels: ElementLevels): ElementId {
  let best: ElementId = ELEMENTS[0];
  let bestVal = -1;
  for (const el of ELEMENTS) {
    if (elementLevels[el] > bestVal) {
      bestVal = elementLevels[el];
      best = el;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Main mapper
// ---------------------------------------------------------------------------

export function mapTraitsToVisuals(
  traitValues: TraitValues,
  elementLevels: ElementLevels,
  activeSynergies: Synergy[],
): VisualParams {
  // Normalise traits to 0-1 range for interpolation
  const t = (trait: TraitId): number => clamp(traitValues[trait] / 100, 0, 1);

  // ---- Colour derivation ----
  const dominant = dominantElement(elementLevels);
  const maxLevel = Math.max(...ELEMENTS.map((e) => elementLevels[e]), 1);

  let bodyHue = ELEMENT_HUE[dominant];
  let bodySaturation = 20 + (maxLevel / 100) * 60;
  let bodyLightness = 15 + clamp(t('skinTex'), 0, 1) * 30;
  let bodyOpacity = lerp(0.3, 1, t('bodySize'));

  // ---- Body ----
  const bodyWidth = lerp(50, 200, t('bodySize'));
  const bodyHeight = lerp(40, 180, t('bodySize'));
  let bodyBlobiness = lerp(0, 0.6, 1 - t('posture'));

  // ---- Head ----
  const headSize = lerp(0.2, 0.8, t('headSize'));
  const headYOffset = lerp(-20, 20, t('posture'));

  // ---- Eyes ----
  const eyeCount = stepped(traitValues.eyeDev, [
    [0, 1],
    [20, 2],
    [60, 3],
    [90, 4],
  ] as const);
  const eyeSize = lerp(3, 18, t('eyeDev'));
  let eyeGlow = lerp(0, 1, t('eyeDev'));
  const pupilShape = lerp(0, 1, t('spininess'));
  const eyeColor = `hsl(${bodyHue}, ${clamp(bodySaturation + 20, 0, 100)}%, ${clamp(bodyLightness + 20, 0, 80)}%)`;

  // ---- Limbs ----
  const limbCount = stepped(traitValues.limbGrowth, [
    [0, 0],
    [15, 1],
    [30, 2],
    [45, 3],
    [60, 4],
    [80, 6],
  ] as const);
  const limbLength = lerp(15, 80, t('limbGrowth'));
  let limbThickness = lerp(2, 8, t('limbGrowth') * 0.5 + t('bodySize') * 0.5);
  const limbCurve = lerp(0, 1, t('tailGrowth') * 0.3 + t('posture') * 0.7);

  // ---- Details ----
  const spineCount = Math.round(lerp(0, 12, t('spininess')));
  const spineLength = lerp(0, 25, t('spininess'));
  const tailLength = lerp(0, 60, t('tailGrowth'));
  const tailCurve = lerp(0, 1, t('tailGrowth'));
  const clawSize = lerp(0, 12, t('clawDev'));

  // ---- Texture ----
  const furDensity = lerp(0, 1, t('furDensity'));
  const skinRoughness = lerp(0, 1, t('skinTex'));

  // ---- Meta ----
  let postureAngle = lerp(0, 45, t('posture'));
  let symmetry = lerp(0.5, 1, t('posture') * 0.5 + 0.5);
  let glowIntensity = 0;
  let glowHue = bodyHue;

  // ---- Synergy visual effects ----
  const activeSynergyVisuals: string[] = [];

  for (const syn of activeSynergies) {
    if (!syn.visualEffect) continue;
    activeSynergyVisuals.push(syn.visualEffect);

    switch (syn.visualEffect) {
      case 'blood_red':
        bodyHue = bodyHue * 0.3 + 0 * 0.7; // shift toward 0 (red)
        bodySaturation = clamp(bodySaturation + 20, 0, 100);
        break;

      case 'toxic_green':
        bodyHue = bodyHue * 0.3 + 120 * 0.7; // shift toward 120 (green)
        glowIntensity = clamp(glowIntensity + 0.3, 0, 0.8);
        glowHue = 120;
        break;

      case 'neural_glow':
        eyeGlow = clamp(eyeGlow + 0.4, 0, 1);
        glowIntensity = clamp(glowIntensity + 0.4, 0, 0.8);
        glowHue = 260;
        break;

      case 'skeletal':
        limbThickness = clamp(limbThickness + 2, 2, 10);
        postureAngle = clamp(postureAngle + 10, 0, 45);
        break;

      case 'organic_harmony':
        symmetry = clamp(symmetry + 0.15, 0.5, 1);
        bodyOpacity = clamp(bodyOpacity + 0.15, 0.3, 1);
        break;

      case 'chaos_shimmer':
        symmetry = clamp(symmetry - 0.2, 0.5, 1);
        bodyBlobiness = clamp(bodyBlobiness + 0.25, 0, 1);
        break;
    }
  }

  // ---- Personality-driven trait levels ----
  // Personality traits — normalized as relative distribution (sum to 1)
  const rawAggr = t('aggression');
  const rawLumi = t('luminosity');
  const rawToxi = t('toxicity');
  const rawInte = t('intelligence');
  const rawArmo = t('armoring');
  const personalityTotal = rawAggr + rawLumi + rawToxi + rawInte + rawArmo;
  const pNorm = personalityTotal > 0 ? 1 / personalityTotal : 0;
  const aggressionLevel = rawAggr * pNorm;
  const luminosityLevel = rawLumi * pNorm;
  const toxicityLevel = rawToxi * pNorm;
  const intelligenceLevel = rawInte * pNorm;
  const armoringLevel = rawArmo * pNorm;

  // ---- Cross-trait visual modifications ----

  // Aggression > 0.3: shift hue toward red, increase blobiness slightly
  if (aggressionLevel > 0.3) {
    const aggrFactor = (aggressionLevel - 0.3) / 0.7; // 0-1 within active range
    bodyHue = bodyHue + aggrFactor * 70 * ((bodyHue > 180 ? -1 : 1)); // shift toward red (0)
    if (bodyHue < 0) bodyHue += 360;
    if (bodyHue > 360) bodyHue -= 360;
    bodyBlobiness = clamp(bodyBlobiness + aggrFactor * 0.1, 0, 1);
  }

  // Luminosity > 0.2: increase glow, brighten body
  if (luminosityLevel > 0.2) {
    const lumiBoost = luminosityLevel * 0.5;
    glowIntensity = clamp(glowIntensity + lumiBoost, 0, 1);
    bodyLightness = clamp(bodyLightness + luminosityLevel * 8, 0, 65);
  }

  // Toxicity > 0.3: shift hue toward green (100-120)
  if (toxicityLevel > 0.3) {
    const toxFactor = (toxicityLevel - 0.3) / 0.7;
    const greenTarget = 110;
    bodyHue = bodyHue * (1 - toxFactor * 0.4) + greenTarget * (toxFactor * 0.4);
    bodySaturation = clamp(bodySaturation + toxFactor * 15, 0, 100);
  }

  // Intelligence > 0.3: increase head size, increase eye size
  let finalHeadSize = headSize;
  let finalEyeSize = eyeSize;
  if (intelligenceLevel > 0.3) {
    finalHeadSize = headSize * (1 + intelligenceLevel * 0.2);
    finalEyeSize = eyeSize * (1 + intelligenceLevel * 0.15);
  }

  // Armoring > 0.3: decrease blobiness (more solid), increase limb thickness
  if (armoringLevel > 0.3) {
    const armorFactor = (armoringLevel - 0.3) / 0.7;
    bodyBlobiness = clamp(bodyBlobiness - armorFactor * 0.2, 0, 1);
    limbThickness = clamp(limbThickness + armorFactor * 2, 2, 12);
  }

  // ---- Color palette (contrasting feature colors) ----
  // Estimate stability from trait balance: more evenly distributed traits = more stable
  const traitVals = TRAITS.map((tid) => traitValues[tid]);
  const maxTrait = Math.max(...traitVals, 1);
  const avgTrait = traitVals.reduce((a, b) => a + b, 0) / traitVals.length;
  const stabilityEstimate = clamp(avgTrait / maxTrait, 0, 1);

  const palette = generateColorPalette(elementLevels, traitValues, stabilityEstimate);

  return {
    bodyWidth,
    bodyHeight,
    bodyBlobiness,
    bodyHue,
    bodySaturation,
    bodyLightness,
    bodyOpacity,

    headSize: finalHeadSize,
    headYOffset,

    eyeCount,
    eyeSize: finalEyeSize,
    eyeColor,
    eyeGlow,
    pupilShape,

    limbCount,
    limbLength,
    limbThickness,
    limbCurve,

    spineCount,
    spineLength,
    tailLength,
    tailCurve,
    clawSize,

    furDensity,
    skinRoughness,

    postureAngle,
    symmetry,
    glowIntensity,
    glowHue,

    aggressionLevel,
    luminosityLevel,
    toxicityLevel,
    intelligenceLevel,
    armoringLevel,

    // Color palette fields
    furColor: palette.furColor,
    spineColor: palette.spineColor,
    clawColor: palette.clawColor,
    eyeIrisColor: palette.eyeIrisColor,
    tailColor: palette.tailColor,
    patternType: palette.patternType,
    patternColor: palette.patternColor,
    patternOpacity: palette.patternOpacity,
    bodySecondaryHue: palette.bodySecondaryHue,
    bodySecondaryLightness: palette.bodySecondaryLightness,
    mouthColor: palette.mouthColor,
    toothColor: palette.toothColor,
    veinColor: palette.veinColor,
    glowColorFromPalette: palette.glowColor,

    activeSynergyVisuals,
  };
}
