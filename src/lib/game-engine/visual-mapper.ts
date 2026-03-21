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

  // ---------------------------------------------------------------------------
  // Determine dominant and secondary elements
  // ---------------------------------------------------------------------------
  const sorted = ([...ELEMENTS] as ElementId[]).sort(
    (a, b) => elementLevels[b] - elementLevels[a],
  );
  const dom: ElementId = sorted[0];
  const sec: ElementId = sorted[1];
  const totalElements = ELEMENTS.reduce((sum, el) => sum + elementLevels[el], 0);
  const domRatio = elementLevels[dom] / Math.max(totalElements, 1);

  // ---------------------------------------------------------------------------
  // Element-driven aspect-ratio tables
  // ---------------------------------------------------------------------------
  const ELEMENT_WIDTH_RATIO: Partial<Record<ElementId, number>> = {
    Fe: 1.4, Ca: 1.3, C: 1.2, S: 0.9, Cl: 0.9,
    K: 0.65, Na: 0.65, P: 0.6, N: 1.0, O: 1.0,
  };
  const ELEMENT_HEIGHT_RATIO: Partial<Record<ElementId, number>> = {
    Fe: 0.7, Ca: 0.9, C: 0.85, S: 1.1, Cl: 1.1,
    K: 1.35, Na: 1.35, P: 1.4, N: 1.0, O: 1.0,
  };

  // ---------------------------------------------------------------------------
  // Colour derivation
  // ---------------------------------------------------------------------------
  const maxLevel = Math.max(...ELEMENTS.map((e) => elementLevels[e]), 1);

  let bodyHue = ELEMENT_HUE[dom];
  let bodySaturation = 20 + (maxLevel / 100) * 60;
  let bodyLightness = 15 + clamp(t('skinTex'), 0, 1) * 30;
  let bodyOpacity = lerp(0.3, 1, t('bodySize'));

  // ---------------------------------------------------------------------------
  // Body — element-driven proportions
  // ---------------------------------------------------------------------------
  const sizeT = t('bodySize');
  const baseSize = lerp(60, 180, sizeT);

  // Primary ratio from dominant element
  let widthRatio = ELEMENT_WIDTH_RATIO[dom] ?? 1.0;
  let heightRatio = ELEMENT_HEIGHT_RATIO[dom] ?? 1.0;

  // Blend secondary element for extra variety (30 % weight, scaled by how
  // dominant the primary actually is — if domRatio is low, secondary matters more)
  const secWeight = lerp(0.15, 0.35, 1 - domRatio);
  const secWidthRatio = ELEMENT_WIDTH_RATIO[sec] ?? 1.0;
  const secHeightRatio = ELEMENT_HEIGHT_RATIO[sec] ?? 1.0;
  widthRatio = widthRatio * (1 - secWeight) + secWidthRatio * secWeight;
  heightRatio = heightRatio * (1 - secWeight) + secHeightRatio * secWeight;

  const bodyWidth = baseSize * widthRatio;
  const bodyHeight = baseSize * heightRatio;

  // Blobiness: spiny/toxic creatures are more irregular; armored are solid
  let bodyBlobiness: number;
  if (dom === 'S' || dom === 'Cl') {
    bodyBlobiness = lerp(0.15, 0.8, 1 - t('posture'));
  } else if (dom === 'Ca' || dom === 'C') {
    bodyBlobiness = lerp(0, 0.25, 1 - t('posture'));
  } else {
    bodyBlobiness = lerp(0, 0.6, 1 - t('posture'));
  }

  // ---------------------------------------------------------------------------
  // Head — element-driven size
  // ---------------------------------------------------------------------------
  let headSize: number;
  if (dom === 'K' || dom === 'Na') {
    // Cerebral: bigger head
    headSize = lerp(0.4, 1.0, t('headSize'));
  } else if (dom === 'Fe' || dom === 'Ca' || dom === 'C') {
    // Brutes/tanks: smaller head
    headSize = lerp(0.15, 0.55, t('headSize'));
  } else if (dom === 'P') {
    // Alien: medium-large head
    headSize = lerp(0.3, 0.85, t('headSize'));
  } else {
    headSize = lerp(0.2, 0.8, t('headSize'));
  }

  const headYOffset = lerp(-20, 20, t('posture'));

  // ---------------------------------------------------------------------------
  // Eyes — dramatically different by element
  // ---------------------------------------------------------------------------
  let eyeCount: number;
  if (traitValues.eyeDev < 5) {
    // Very underdeveloped: blind creature
    eyeCount = 0;
  } else if (dom === 'K' || dom === 'Na' || dom === 'P') {
    // Neural/phosphorus creatures get more eyes earlier
    eyeCount = stepped(traitValues.eyeDev, [
      [5, 1], [15, 2], [30, 3], [50, 4], [70, 5], [90, 6],
    ] as const);
  } else if (dom === 'Fe' || dom === 'Ca') {
    // Brutes/tanks: fewer eyes
    eyeCount = stepped(traitValues.eyeDev, [
      [5, 1], [40, 2], [80, 3],
    ] as const);
  } else if (dom === 'S' || dom === 'Cl') {
    // Toxic creatures: irregular eye pattern
    eyeCount = stepped(traitValues.eyeDev, [
      [5, 1], [20, 2], [35, 4], [60, 3], [80, 5],
    ] as const);
  } else {
    eyeCount = stepped(traitValues.eyeDev, [
      [5, 1], [25, 2], [55, 3], [85, 4],
    ] as const);
  }

  // Eye SIZE varies by element
  const eyeSizeBase = lerp(3, 18, t('eyeDev'));
  const eyeSizeMult =
    (dom === 'P' || dom === 'K') ? 1.4 :
    (dom === 'Fe' || dom === 'Ca') ? 0.7 :
    (dom === 'Na') ? 1.2 :
    1.0;
  const eyeSize = eyeSizeBase * eyeSizeMult;

  let eyeGlow = lerp(0, 1, t('eyeDev'));
  // Phosphorus creatures always have some glow
  if (dom === 'P') eyeGlow = clamp(eyeGlow + 0.3, 0, 1);

  const pupilShape = lerp(0, 1, t('spininess'));
  const eyeColor = `hsl(${bodyHue}, ${clamp(bodySaturation + 20, 0, 100)}%, ${clamp(bodyLightness + 20, 0, 80)}%)`;

  // ---------------------------------------------------------------------------
  // Limbs — element-driven count and thickness
  // ---------------------------------------------------------------------------
  let limbCount: number;
  let limbThickness = lerp(2, 8, t('limbGrowth') * 0.5 + t('bodySize') * 0.5);

  // Serpentine check: S dominant + high Cl → no limbs, massive tail instead
  const isSerpentine = (dom === 'S' || dom === 'Cl') && elementLevels.Cl > 30 && elementLevels.S > 20;

  if (isSerpentine) {
    limbCount = 0;
    limbThickness *= 0.6; // no limbs, but keep value for tail thickness hint
  } else if (dom === 'Fe' || dom === 'Ca') {
    // Fewer but thicker limbs
    limbCount = stepped(traitValues.limbGrowth, [
      [0, 0], [20, 2], [60, 4],
    ] as const);
    limbThickness *= 1.5;
  } else if (dom === 'K' || dom === 'Na' || dom === 'P') {
    // More limbs but thinner
    limbCount = stepped(traitValues.limbGrowth, [
      [0, 0], [10, 2], [25, 4], [50, 6], [75, 8],
    ] as const);
    limbThickness *= 0.7;
  } else if (dom === 'S' || dom === 'Cl') {
    // Irregular limb count
    limbCount = stepped(traitValues.limbGrowth, [
      [0, 0], [15, 2], [35, 3], [55, 5], [80, 4],
    ] as const);
  } else {
    limbCount = stepped(traitValues.limbGrowth, [
      [0, 0], [15, 2], [40, 4], [70, 6],
    ] as const);
  }

  const limbLength = lerp(15, 80, t('limbGrowth'));
  const limbCurve = lerp(0, 1, t('tailGrowth') * 0.3 + t('posture') * 0.7);

  // ---------------------------------------------------------------------------
  // Tail — element-driven length
  // ---------------------------------------------------------------------------
  let tailLength: number;
  if (isSerpentine) {
    // Serpentine: compensate lack of limbs with huge tail
    tailLength = lerp(40, 100, t('tailGrowth'));
  } else if (dom === 'Fe') {
    // Brutes have stubby tails
    tailLength = lerp(0, 60, t('tailGrowth')) * 0.5;
  } else if (dom === 'K' || dom === 'P') {
    // Elegant tails
    tailLength = lerp(0, 60, t('tailGrowth')) * 1.3;
  } else {
    tailLength = lerp(0, 60, t('tailGrowth'));
  }
  const tailCurve = lerp(0, 1, t('tailGrowth'));

  // ---------------------------------------------------------------------------
  // Spines — element-driven count and size
  // ---------------------------------------------------------------------------
  let spineCount: number;
  let spineLength: number;

  if (dom === 'S' || dom === 'Cl') {
    // Many small spines — spiny horror
    spineCount = Math.round(lerp(0, 20, t('spininess')));
    spineLength = lerp(0, 15, t('spininess'));
  } else if (dom === 'Ca') {
    // Few big horn-like protrusions
    spineCount = Math.round(lerp(0, 5, t('spininess')));
    spineLength = lerp(0, 35, t('spininess'));
  } else if (dom === 'K' || dom === 'Na') {
    // Minimal — smooth cerebral beings
    spineCount = Math.round(lerp(0, 3, t('spininess')));
    spineLength = lerp(0, 10, t('spininess'));
  } else if (dom === 'Fe') {
    // Medium spines, thick
    spineCount = Math.round(lerp(0, 8, t('spininess')));
    spineLength = lerp(0, 20, t('spininess'));
  } else {
    spineCount = Math.round(lerp(0, 12, t('spininess')));
    spineLength = lerp(0, 25, t('spininess'));
  }

  // ---------------------------------------------------------------------------
  // Claws — element-driven size
  // ---------------------------------------------------------------------------
  let clawSize: number;
  if (dom === 'Fe' || dom === 'S') {
    // Large fearsome claws
    clawSize = lerp(0, 18, t('clawDev'));
  } else if (dom === 'K' || dom === 'P') {
    // Delicate / small claws
    clawSize = lerp(0, 5, t('clawDev'));
  } else if (dom === 'Ca') {
    // Medium sturdy claws
    clawSize = lerp(0, 14, t('clawDev'));
  } else {
    clawSize = lerp(0, 12, t('clawDev'));
  }

  // ---------------------------------------------------------------------------
  // Texture — fur and skin
  // ---------------------------------------------------------------------------
  let furDensity = lerp(0, 1, t('furDensity'));
  // Metallic/toxic creatures have less fur; organic creatures have more
  if (dom === 'Fe' || dom === 'S') {
    furDensity *= 0.3;
  } else if (dom === 'Cl') {
    furDensity *= 0.4;
  } else if (dom === 'N' || dom === 'O') {
    furDensity = clamp(furDensity * 1.5, 0, 1);
  } else if (dom === 'P') {
    furDensity *= 0.5; // smooth alien
  }
  // Ca: fur maps to scale-like pattern (keep numeric value, renderer interprets)

  const skinRoughness = lerp(0, 1, t('skinTex'));

  // ---------------------------------------------------------------------------
  // Posture — element-driven max angle
  // ---------------------------------------------------------------------------
  let maxPosture: number;
  if (dom === 'Fe') {
    maxPosture = 25; // hunched gorilla
  } else if (dom === 'S' || dom === 'Cl') {
    maxPosture = 20; // crouched lurker
  } else if (dom === 'Ca') {
    maxPosture = 30; // medium stance
  } else if (dom === 'K' || dom === 'Na' || dom === 'P') {
    maxPosture = 45; // tall and upright
  } else {
    maxPosture = 40; // organic normal
  }
  let postureAngle = lerp(0, maxPosture, t('posture'));

  // Symmetry: cerebral = high, toxic = low
  let symmetry: number;
  if (dom === 'K' || dom === 'Na' || dom === 'O' || dom === 'N') {
    symmetry = lerp(0.7, 1, t('posture') * 0.5 + 0.5);
  } else if (dom === 'S' || dom === 'Cl') {
    symmetry = lerp(0.35, 0.8, t('posture') * 0.5 + 0.5);
  } else {
    symmetry = lerp(0.5, 1, t('posture') * 0.5 + 0.5);
  }

  // Glow: phosphorus creatures glow by default
  let glowIntensity = 0;
  let glowHue = bodyHue;
  if (dom === 'P') {
    glowIntensity = lerp(0.15, 0.6, t('luminosity'));
    glowHue = 120; // green phosphorescent
  }

  // ---------------------------------------------------------------------------
  // Synergy visual effects (preserved from original)
  // ---------------------------------------------------------------------------
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
        symmetry = clamp(symmetry - 0.2, 0.3, 1);
        bodyBlobiness = clamp(bodyBlobiness + 0.25, 0, 1);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Personality-driven trait levels (preserved from original)
  // ---------------------------------------------------------------------------
  // Personality: use raw trait values (0-100) for normalization, NOT the 0-1 t() values.
  // This way, small differences in absolute values matter — not just relative 0-1 fractions.
  // We square the values to amplify differences: a trait at 80 vs 60 becomes 6400 vs 3600.
  const rawAggr = Math.pow(traitValues.aggression, 1.5);
  const rawLumi = Math.pow(traitValues.luminosity, 1.5);
  const rawToxi = Math.pow(traitValues.toxicity, 1.5);
  const rawInte = Math.pow(traitValues.intelligence, 1.5);
  const rawArmo = Math.pow(traitValues.armoring, 1.5);
  const personalityTotal = rawAggr + rawLumi + rawToxi + rawInte + rawArmo;
  const pNorm = personalityTotal > 0 ? 1 / personalityTotal : 0;
  const aggressionLevel = rawAggr * pNorm;
  const luminosityLevel = rawLumi * pNorm;
  const toxicityLevel = rawToxi * pNorm;
  const intelligenceLevel = rawInte * pNorm;
  const armoringLevel = rawArmo * pNorm;

  // ---------------------------------------------------------------------------
  // Cross-trait visual modifications (preserved from original)
  // ---------------------------------------------------------------------------

  // Aggression > 0.3: shift hue toward red, increase blobiness slightly
  if (aggressionLevel > 0.3) {
    const aggrFactor = (aggressionLevel - 0.3) / 0.7;
    bodyHue = bodyHue + aggrFactor * 70 * ((bodyHue > 180 ? -1 : 1));
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

  // ---------------------------------------------------------------------------
  // Color palette (preserved from original)
  // ---------------------------------------------------------------------------
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
