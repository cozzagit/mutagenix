"use client";

import { useMemo, useId } from "react";
import type { VisualParams } from "@/lib/game-engine/visual-mapper";
import { CreatureParticles } from "./creature-particles";

/* ------------------------------------------------------------------ */
/* Default visual params — initial primitive blob state               */
/* ------------------------------------------------------------------ */

export const DEFAULT_VISUAL_PARAMS: VisualParams = {
  bodyWidth: 70,
  bodyHeight: 60,
  bodyBlobiness: 0.8,
  bodyHue: 210,
  bodySaturation: 15,
  bodyLightness: 25,
  bodyOpacity: 0.55,
  headSize: 0.3,
  headYOffset: 0,
  eyeCount: 1,
  eyeSize: 5,
  eyeColor: "hsl(210,30%,60%)",
  eyeGlow: 0.15,
  pupilShape: 0,
  limbCount: 0,
  limbLength: 20,
  limbThickness: 3,
  limbCurve: 0.3,
  spineCount: 0,
  spineLength: 0,
  tailLength: 0,
  tailCurve: 0.5,
  clawSize: 0,
  furDensity: 0,
  skinRoughness: 0.1,
  postureAngle: 0,
  symmetry: 0.7,
  glowIntensity: 0.2,
  glowHue: 210,
  aggressionLevel: 0,
  luminosityLevel: 0,
  toxicityLevel: 0,
  intelligenceLevel: 0,
  armoringLevel: 0,
  // Color palette defaults (neutral blob)
  furColor: "hsl(210, 20%, 40%)",
  spineColor: "hsl(30, 30%, 35%)",
  clawColor: "hsl(40, 20%, 70%)",
  eyeIrisColor: "hsl(210, 60%, 50%)",
  tailColor: "hsl(210, 18%, 30%)",
  patternType: "none",
  patternColor: "hsl(210, 15%, 30%)",
  patternOpacity: 0,
  bodySecondaryHue: 240,
  bodySecondaryLightness: 43,
  mouthColor: "hsl(350, 60%, 25%)",
  toothColor: "hsl(40, 30%, 85%)",
  veinColor: "hsl(5, 40%, 20%)",
  glowColorFromPalette: "hsl(210, 70%, 55%)",
  activeSynergyVisuals: [],
  // Combat/Warrior phase defaults
  combatPhase: 0,
  attackGlow: 0,
  defensePatches: 0,
  speedLines: 0,
  muscleDefinition: 0,
  scarCount: 0,
  specialAuraIntensity: 0,
};

/* ------------------------------------------------------------------ */
/* Props                                                              */
/* ------------------------------------------------------------------ */

interface CreatureRendererProps {
  params: VisualParams;
  size?: number;
  animated?: boolean;
  className?: string;
  /** Fixed seed for deterministic shape. Same seed = same random variations. */
  seed?: number;
}

/* ------------------------------------------------------------------ */
/* Seeded PRNG — deterministic randomness                             */
/* ------------------------------------------------------------------ */

function makeRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

function paramSeed(p: VisualParams): number {
  return (
    Math.round(p.bodyWidth * 100) ^
    Math.round(p.bodyHue * 17) ^
    Math.round(p.bodySaturation * 31) ^
    Math.round(p.limbCount * 7919) ^
    Math.round(p.eyeCount * 4001) ^
    Math.round(p.spineCount * 2003) ^
    Math.round(p.bodyBlobiness * 9973)
  );
}

/* ------------------------------------------------------------------ */
/* Math helpers                                                       */
/* ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
const f1 = (n: number) => n.toFixed(1);

/* ------------------------------------------------------------------ */
/* Body part drawing helpers                                          */
/* ------------------------------------------------------------------ */

/** Generate a torso path — pear/egg shape, NOT a circle */
function drawTorso(
  cx: number,
  baseY: number,
  width: number,
  height: number,
  blobiness: number,
  postureT: number,
  rng: () => number,
): string {
  // postureT 0 = wide blob, 1 = tall upright
  // Width narrows at top (shoulders), wider at bottom (hips) for low posture
  // More uniform when upright
  const shoulderW = width * lerp(0.7, 0.9, postureT);
  const hipW = width * lerp(1.1, 0.95, postureT);
  const topY = baseY - height;

  // Jitter for organic feel
  const j = () => (rng() - 0.5) * blobiness * 8;

  // Build path: top-center, right shoulder, right hip, bottom, left hip, left shoulder
  const pts = [
    { x: cx + j(), y: topY + j() },                                   // top center
    { x: cx + shoulderW * 0.5 + j(), y: topY + height * 0.15 + j() }, // right shoulder
    { x: cx + hipW * 0.55 + j(), y: topY + height * 0.55 + j() },     // right mid
    { x: cx + hipW * 0.45 + j(), y: topY + height * 0.85 + j() },     // right hip
    { x: cx + j(), y: baseY + j() },                                   // bottom center
    { x: cx - hipW * 0.45 + j(), y: topY + height * 0.85 + j() },     // left hip
    { x: cx - hipW * 0.55 + j(), y: topY + height * 0.55 + j() },     // left mid
    { x: cx - shoulderW * 0.5 + j(), y: topY + height * 0.15 + j() }, // left shoulder
  ];

  // Smooth closed bezier through points
  const n = pts.length;
  let d = `M ${f1(pts[0].x)} ${f1(pts[0].y)} `;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const t = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * t;
    const cp1y = p1.y + (p2.y - p0.y) * t;
    const cp2x = p2.x - (p3.x - p1.x) * t;
    const cp2y = p2.y - (p3.y - p1.y) * t;
    d += `C ${f1(cp1x)} ${f1(cp1y)}, ${f1(cp2x)} ${f1(cp2y)}, ${f1(p2.x)} ${f1(p2.y)} `;
  }
  d += "Z";
  return d;
}

/** Belly highlight — slightly smaller, offset, lighter area */
function drawBelly(
  cx: number,
  baseY: number,
  width: number,
  height: number,
): string {
  const bellyW = width * 0.45;
  const bellyH = height * 0.4;
  const bellyY = baseY - height * 0.35;
  return `M ${f1(cx)} ${f1(bellyY - bellyH * 0.5)}
    Q ${f1(cx + bellyW)} ${f1(bellyY)} ${f1(cx)} ${f1(bellyY + bellyH * 0.5)}
    Q ${f1(cx - bellyW)} ${f1(bellyY)} ${f1(cx)} ${f1(bellyY - bellyH * 0.5)} Z`;
}

/** Head shape — rounded but not a perfect circle */
function drawHead(
  cx: number,
  cy: number,
  radius: number,
  headSizeT: number,
  blobiness: number,
  rng: () => number,
): string {
  // More angular jaw at higher headSize
  const jawWidth = radius * lerp(0.6, 0.85, headSizeT);
  const jawDrop = radius * lerp(0.3, 0.6, headSizeT);
  const j = () => (rng() - 0.5) * blobiness * 3;

  return `M ${f1(cx)} ${f1(cy - radius + j())}
    C ${f1(cx + radius * 0.6 + j())} ${f1(cy - radius * 0.9 + j())},
      ${f1(cx + radius + j())} ${f1(cy - radius * 0.3 + j())},
      ${f1(cx + radius * 0.9 + j())} ${f1(cy + j())}
    C ${f1(cx + radius * 0.85 + j())} ${f1(cy + radius * 0.3 + j())},
      ${f1(cx + jawWidth + j())} ${f1(cy + jawDrop + j())},
      ${f1(cx + j())} ${f1(cy + jawDrop + radius * 0.15 + j())}
    C ${f1(cx - jawWidth + j())} ${f1(cy + jawDrop + j())},
      ${f1(cx - radius * 0.85 + j())} ${f1(cy + radius * 0.3 + j())},
      ${f1(cx - radius * 0.9 + j())} ${f1(cy + j())}
    C ${f1(cx - radius + j())} ${f1(cy - radius * 0.3 + j())},
      ${f1(cx - radius * 0.6 + j())} ${f1(cy - radius * 0.9 + j())},
      ${f1(cx)} ${f1(cy - radius + j())} Z`;
}

/** Eye positions on the head */
function eyePositions(
  count: number,
  headCx: number,
  headCy: number,
  headR: number,
): { x: number; y: number }[] {
  const off = headR * 0.35;
  switch (count) {
    case 1:
      return [{ x: headCx, y: headCy - headR * 0.1 }];
    case 2:
      return [
        { x: headCx - off, y: headCy - headR * 0.1 },
        { x: headCx + off, y: headCy - headR * 0.1 },
      ];
    case 3:
      return [
        { x: headCx, y: headCy - off * 0.8 },
        { x: headCx - off, y: headCy + off * 0.3 },
        { x: headCx + off, y: headCy + off * 0.3 },
      ];
    case 4:
    default:
      return [
        { x: headCx - off * 0.6, y: headCy - off * 0.6 },
        { x: headCx + off * 0.6, y: headCy - off * 0.6 },
        { x: headCx - off * 0.8, y: headCy + off * 0.3 },
        { x: headCx + off * 0.8, y: headCy + off * 0.3 },
      ];
  }
}

/** Draw a single eye with sclera, iris, pupil, highlight */
function drawEyeSvg(
  ex: number,
  ey: number,
  size: number,
  eyeColor: string,
  pupilShape: number,
  bodyHue: number,
  bodyColorDark: string,
  irisGradId: string,
  eyeGlowFilterId: string,
  eyeGlow: number,
  glowColor: string,
  animated: boolean,
  blinkDelay: number,
  index: number,
): React.ReactElement {
  const sz = size;
  return (
    <g
      key={`eye-${index}`}
      style={
        animated
          ? { animation: `blink ${blinkDelay}s ease-in-out ${index * 0.4}s infinite` }
          : undefined
      }
    >
      {/* Glow behind eye */}
      {eyeGlow > 0.05 && (
        <circle cx={ex} cy={ey} r={sz * 2} fill={eyeColor} opacity={eyeGlow * 0.15}
          filter={`url(#${eyeGlowFilterId})`} />
      )}
      {/* Sclera */}
      <ellipse cx={ex} cy={ey} rx={sz} ry={sz * 0.85} fill={`hsl(${bodyHue}, 8%, 87%)`} opacity={0.95} />
      <ellipse cx={ex} cy={ey} rx={sz} ry={sz * 0.85} fill="none" stroke={bodyColorDark}
        strokeWidth={0.5} opacity={0.3} />
      {/* Iris */}
      <circle cx={ex} cy={ey} r={sz * 0.55} fill={`url(#${irisGradId})`} />
      {/* Iris ring */}
      <circle cx={ex} cy={ey} r={sz * 0.48} fill="none" stroke={eyeColor} strokeWidth={0.4} opacity={0.35} />
      {/* Pupil */}
      <g
        style={
          animated
            ? { animation: "pupil-pulse 5s ease-in-out infinite", transformOrigin: `${ex}px ${ey}px` }
            : undefined
        }
      >
        {pupilShape < 0.4 ? (
          <circle cx={ex} cy={ey} r={sz * 0.22} fill="#050508" />
        ) : (
          <ellipse cx={ex} cy={ey}
            rx={sz * 0.08 + (1 - pupilShape) * sz * 0.1}
            ry={sz * 0.35} fill="#050508" />
        )}
      </g>
      {/* Highlight */}
      <circle cx={ex - sz * 0.2} cy={ey - sz * 0.18} r={sz * 0.12} fill="white" opacity={0.85} />
      <circle cx={ex + sz * 0.12} cy={ey + sz * 0.1} r={sz * 0.05} fill="white" opacity={0.4} />
    </g>
  );
}

/** Draw a limb with upper + lower segment, joint, and foot/hand */
function drawLimbPath(
  startX: number,
  startY: number,
  angle: number,
  length: number,
  thickness: number,
  isArm: boolean,
  side: number, // -1 left, 1 right
  postureT: number,
): { upper: string; lower: string; jointX: number; jointY: number; endX: number; endY: number } {
  const upperLen = length * 0.48;
  const lowerLen = length * 0.52;

  // Upper segment direction
  const upperAngle = isArm
    ? lerp(Math.PI * 0.35, Math.PI * 0.15, postureT) * side + (1 - postureT) * 0.3
    : lerp(Math.PI * 0.55, Math.PI * 0.48, postureT) * side * 0.3 + Math.PI * 0.5;

  // Joint position
  const jointX = startX + Math.cos(upperAngle) * upperLen * side;
  const jointY = startY + Math.sin(upperAngle) * upperLen;

  // Lower segment — bends at joint
  const kneeAngle = isArm
    ? upperAngle + lerp(0.4, 0.8, postureT) * side * 0.5
    : Math.PI * 0.5 + side * lerp(0.2, 0.05, postureT);

  const endX = jointX + Math.cos(kneeAngle) * lowerLen * (isArm ? side : 1);
  const endY = jointY + Math.sin(kneeAngle) * lowerLen;

  // Slight curve for organic feel
  const upperCpX = (startX + jointX) / 2 + side * thickness * 0.3;
  const upperCpY = (startY + jointY) / 2 - thickness * 0.2;
  const lowerCpX = (jointX + endX) / 2 + side * thickness * 0.2;
  const lowerCpY = (jointY + endY) / 2;

  const upper = `M ${f1(startX)} ${f1(startY)} Q ${f1(upperCpX)} ${f1(upperCpY)} ${f1(jointX)} ${f1(jointY)}`;
  const lower = `M ${f1(jointX)} ${f1(jointY)} Q ${f1(lowerCpX)} ${f1(lowerCpY)} ${f1(endX)} ${f1(endY)}`;

  return { upper, lower, jointX, jointY, endX, endY };
}

/** Draw claws/fingers at a limb end */
function drawClaws(
  ex: number,
  ey: number,
  clawSize: number,
  angle: number,
  side: number,
  isArm: boolean,
): string[] {
  if (clawSize < 1) return [];
  // Number of claws based on size
  const count = clawSize < 3 ? 2 : clawSize < 6 ? 3 : 4;
  const spread = lerp(0.3, 0.7, clawSize / 12);
  const claws: string[] = [];

  for (let i = 0; i < count; i++) {
    const frac = (i / (count - 1)) - 0.5; // -0.5 to 0.5
    const clawAngle = (isArm ? angle + Math.PI * 0.5 : Math.PI * 0.5) + frac * spread;
    const len = clawSize * lerp(0.8, 1.2, Math.abs(frac));
    const tipX = ex + Math.cos(clawAngle) * len * (isArm ? side : 1);
    const tipY = ey + Math.sin(clawAngle) * len;
    // Curved tapered claw
    const cpX = ex + Math.cos(clawAngle) * len * 0.5 * (isArm ? side : 1) + (1 - Math.abs(frac)) * 2 * side;
    const cpY = ey + Math.sin(clawAngle) * len * 0.5;
    claws.push(`M ${f1(ex)} ${f1(ey)} Q ${f1(cpX)} ${f1(cpY)} ${f1(tipX)} ${f1(tipY)}`);
  }
  return claws;
}

/** Draw a spine triangle */
function drawSpine(
  baseX: number,
  baseY: number,
  height: number,
  angle: number,
): string {
  const tipX = baseX + Math.cos(angle) * height;
  const tipY = baseY + Math.sin(angle) * height;
  const perpX = Math.sin(angle) * height * 0.18;
  const perpY = -Math.cos(angle) * height * 0.18;
  return `M ${f1(baseX - perpX)} ${f1(baseY - perpY)} L ${f1(tipX)} ${f1(tipY)} L ${f1(baseX + perpX)} ${f1(baseY + perpY)} Z`;
}

/** Draw tail as tapering cubic bezier */
function drawTail(
  startX: number,
  startY: number,
  length: number,
  curve: number,
): string {
  if (length < 3) return "";
  const cp1X = startX + length * curve * 0.4;
  const cp1Y = startY + length * 0.25;
  const cp2X = startX - length * curve * 0.3;
  const cp2Y = startY + length * 0.6;
  const endX = startX + length * curve * 0.2;
  const endY = startY + length * 0.95;
  return `M ${f1(startX)} ${f1(startY)} C ${f1(cp1X)} ${f1(cp1Y)}, ${f1(cp2X)} ${f1(cp2Y)}, ${f1(endX)} ${f1(endY)}`;
}

/** Draw fur tufts along a contour — wavy hair strands with cubic bezier curves */
function drawFurTufts(
  cx: number,
  baseY: number,
  width: number,
  height: number,
  density: number, // 0-1
  rng: () => number,
): { path: string; width: number; opacity: number; isCluster: boolean }[] {
  if (density < 0.08) return [];

  const centerY = baseY - height * 0.5;
  const tufts: { path: string; width: number; opacity: number; isCluster: boolean }[] = [];

  // More strands at higher density — significantly more than before
  const baseCount = Math.round(15 + density * 120);

  for (let i = 0; i < baseCount; i++) {
    const t = rng();
    const angle = t * Math.PI * 2;
    const contourX = cx + Math.cos(angle) * width * 0.52;
    const contourY = centerY + Math.sin(angle) * height * 0.52;

    // Determine region: top/back = longer fur, bottom/belly = shorter
    // angle near -PI/2 (top) = back/head area, near PI/2 (bottom) = belly
    const isTopArea = Math.sin(angle) < -0.2;
    const isBellyArea = Math.sin(angle) > 0.3;
    const regionMult = isTopArea ? 1.4 : isBellyArea ? 0.6 : 1.0;

    // Fur length: 8-35px depending on density and region
    const furLen = (8 + rng() * 27 * density) * regionMult;

    // Direction: outward from body center with natural randomness
    const furAngle = angle + (rng() - 0.5) * 0.7;

    // Build a wavy cubic bezier hair strand
    // Two control points create a natural S-curve / wave
    const waveMag = furLen * (0.15 + rng() * 0.3); // wave amplitude
    const waveDir = rng() > 0.5 ? 1 : -1; // wave direction
    const perpAngle = furAngle + Math.PI * 0.5; // perpendicular to hair direction

    // Control point 1: ~1/3 along the strand, offset perpendicular for wave
    const cp1Dist = furLen * (0.3 + rng() * 0.1);
    const cp1X = contourX + Math.cos(furAngle) * cp1Dist + Math.cos(perpAngle) * waveMag * waveDir;
    const cp1Y = contourY + Math.sin(furAngle) * cp1Dist + Math.sin(perpAngle) * waveMag * waveDir;

    // Control point 2: ~2/3 along the strand, offset opposite for S-curve
    const cp2Dist = furLen * (0.6 + rng() * 0.15);
    const cp2X = contourX + Math.cos(furAngle) * cp2Dist - Math.cos(perpAngle) * waveMag * waveDir * 0.6;
    const cp2Y = contourY + Math.sin(furAngle) * cp2Dist - Math.sin(perpAngle) * waveMag * waveDir * 0.6;

    // End point
    const endX = contourX + Math.cos(furAngle) * furLen + (rng() - 0.5) * 3;
    const endY = contourY + Math.sin(furAngle) * furLen + (rng() - 0.5) * 3;

    // Stroke width: thicker at base (via overall width), taper is handled by varying strand widths
    const baseWidth = 0.5 + density * 2.0 * rng();

    // Opacity variation for depth
    const opacity = 0.5 + rng() * 0.4;

    tufts.push({
      path: `M ${f1(contourX)} ${f1(contourY)} C ${f1(cp1X)} ${f1(cp1Y)}, ${f1(cp2X)} ${f1(cp2Y)}, ${f1(endX)} ${f1(endY)}`,
      width: baseWidth,
      opacity,
      isCluster: false,
    });

    // At high density (>0.5), add CLUSTERS of 2-3 hairs from the same point, slightly fanned
    if (density > 0.5 && rng() < (density - 0.3) * 0.8) {
      const clusterCount = rng() > 0.6 ? 3 : 2;
      for (let c = 0; c < clusterCount; c++) {
        const fanOffset = (c - (clusterCount - 1) / 2) * (0.12 + rng() * 0.1);
        const cAngle = furAngle + fanOffset;
        const cLen = furLen * (0.7 + rng() * 0.4);
        const cWaveMag = cLen * (0.12 + rng() * 0.25);
        const cWaveDir = rng() > 0.5 ? 1 : -1;
        const cPerpAngle = cAngle + Math.PI * 0.5;

        const cCp1Dist = cLen * (0.28 + rng() * 0.12);
        const cCp1X = contourX + Math.cos(cAngle) * cCp1Dist + Math.cos(cPerpAngle) * cWaveMag * cWaveDir;
        const cCp1Y = contourY + Math.sin(cAngle) * cCp1Dist + Math.sin(cPerpAngle) * cWaveMag * cWaveDir;

        const cCp2Dist = cLen * (0.58 + rng() * 0.15);
        const cCp2X = contourX + Math.cos(cAngle) * cCp2Dist - Math.cos(cPerpAngle) * cWaveMag * cWaveDir * 0.5;
        const cCp2Y = contourY + Math.sin(cAngle) * cCp2Dist - Math.sin(cPerpAngle) * cWaveMag * cWaveDir * 0.5;

        const cEndX = contourX + Math.cos(cAngle) * cLen + (rng() - 0.5) * 2;
        const cEndY = contourY + Math.sin(cAngle) * cLen + (rng() - 0.5) * 2;

        const cWidth = 0.4 + density * 1.5 * rng();

        tufts.push({
          path: `M ${f1(contourX)} ${f1(contourY)} C ${f1(cCp1X)} ${f1(cCp1Y)}, ${f1(cCp2X)} ${f1(cCp2Y)}, ${f1(cEndX)} ${f1(cEndY)}`,
          width: cWidth,
          opacity: 0.4 + rng() * 0.35,
          isCluster: true,
        });
      }
    }

    // Add extra mane/crest tufts on the head area (top of creature)
    if (isTopArea && rng() < density * 0.7) {
      const maneAngle = furAngle + (rng() - 0.5) * 0.3;
      const maneLen = furLen * (1.2 + rng() * 0.5); // longer than normal
      const mWaveMag = maneLen * (0.18 + rng() * 0.25);
      const mWaveDir = rng() > 0.5 ? 1 : -1;
      const mPerpAngle = maneAngle + Math.PI * 0.5;

      const mCp1X = contourX + Math.cos(maneAngle) * maneLen * 0.32 + Math.cos(mPerpAngle) * mWaveMag * mWaveDir;
      const mCp1Y = contourY + Math.sin(maneAngle) * maneLen * 0.32 + Math.sin(mPerpAngle) * mWaveMag * mWaveDir;

      const mCp2X = contourX + Math.cos(maneAngle) * maneLen * 0.65 - Math.cos(mPerpAngle) * mWaveMag * mWaveDir * 0.7;
      const mCp2Y = contourY + Math.sin(maneAngle) * maneLen * 0.65 - Math.sin(mPerpAngle) * mWaveMag * mWaveDir * 0.7;

      const mEndX = contourX + Math.cos(maneAngle) * maneLen + (rng() - 0.5) * 4;
      const mEndY = contourY + Math.sin(maneAngle) * maneLen + (rng() - 0.5) * 4;

      tufts.push({
        path: `M ${f1(contourX)} ${f1(contourY)} C ${f1(mCp1X)} ${f1(mCp1Y)}, ${f1(mCp2X)} ${f1(mCp2Y)}, ${f1(mEndX)} ${f1(mEndY)}`,
        width: 0.8 + density * 1.8 * rng(),
        opacity: 0.55 + rng() * 0.35,
        isCluster: false,
      });
    }
  }

  return tufts;
}

/** Draw mouth with optional teeth */
function drawMouth(
  cx: number,
  cy: number,
  mouthWidth: number,
  headSizeT: number,
): { mouthPath: string; teeth: string[] } {
  if (headSizeT < 0.2) {
    return { mouthPath: "", teeth: [] };
  }

  // Simple line mouth at low values, open mouth at higher
  const openness = lerp(0, 4, (headSizeT - 0.2) / 0.8);
  const halfW = mouthWidth * 0.5;

  let mouthPath: string;
  if (openness < 1.5) {
    // Closed/slightly curved mouth
    mouthPath = `M ${f1(cx - halfW)} ${f1(cy)} Q ${f1(cx)} ${f1(cy + openness)} ${f1(cx + halfW)} ${f1(cy)}`;
  } else {
    // Open mouth — two curves forming an open shape
    mouthPath = `M ${f1(cx - halfW)} ${f1(cy)}
      Q ${f1(cx)} ${f1(cy + openness * 1.5)} ${f1(cx + halfW)} ${f1(cy)}
      Q ${f1(cx)} ${f1(cy + openness * 0.3)} ${f1(cx - halfW)} ${f1(cy)} Z`;
  }

  // Teeth
  const teeth: string[] = [];
  if (headSizeT > 0.35) {
    const teethCount = Math.round(lerp(2, 8, (headSizeT - 0.35) / 0.65));
    const teethH = lerp(1.5, 4, (headSizeT - 0.35) / 0.65);
    for (let i = 0; i < teethCount; i++) {
      const frac = (i + 0.5) / teethCount;
      const tx = cx - halfW + frac * mouthWidth;
      const tw = mouthWidth / teethCount * 0.35;
      // Triangle tooth pointing down
      teeth.push(`M ${f1(tx - tw)} ${f1(cy)} L ${f1(tx)} ${f1(cy + teethH)} L ${f1(tx + tw)} ${f1(cy)} Z`);
    }
  }

  return { mouthPath, teeth };
}

/* ------------------------------------------------------------------ */
/* Neck drawing                                                        */
/* ------------------------------------------------------------------ */

function drawNeck(
  headCx: number,
  headBottomY: number,
  bodyTopX: number,
  bodyTopY: number,
  neckWidth: number,
): string {
  const halfW = neckWidth * 0.5;
  return `M ${f1(headCx - halfW * 0.8)} ${f1(headBottomY)}
    C ${f1(headCx - halfW * 1.1)} ${f1((headBottomY + bodyTopY) * 0.5)},
      ${f1(bodyTopX - halfW * 0.6)} ${f1(bodyTopY)},
      ${f1(bodyTopX - halfW * 0.3)} ${f1(bodyTopY)}
    L ${f1(bodyTopX + halfW * 0.3)} ${f1(bodyTopY)}
    C ${f1(bodyTopX + halfW * 0.6)} ${f1(bodyTopY)},
      ${f1(headCx + halfW * 1.1)} ${f1((headBottomY + bodyTopY) * 0.5)},
      ${f1(headCx + halfW * 0.8)} ${f1(headBottomY)} Z`;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function CreatureRenderer({
  params,
  size = 300,
  animated = true,
  className = "",
  seed: fixedSeed,
}: CreatureRendererProps) {
  const instanceId = useId().replace(/:/g, "");

  const svg = useMemo(() => {
    const p = params;
    // Use fixed seed if provided, otherwise derive from params
    const rng = makeRng(fixedSeed ?? 42);
    const id = (name: string) => `${instanceId}-${name}`;

    // ---- Posture (0-1 from postureAngle 0-45) ----
    const postureT = clamp(p.postureAngle / 45, 0, 1);

    // ---- Scale: creature grows with bodyWidth/Height ----
    // bodyWidth ranges 50-200, bodyHeight 40-180
    const scaleT = clamp((p.bodyWidth - 50) / 150, 0, 1);
    const creatureH = lerp(80, 280, scaleT);
    const creatureW = lerp(60, 180, scaleT);

    // ---- Posture affects aspect ratio ----
    const torsoH = creatureH * lerp(0.5, 0.65, postureT);
    const torsoW = creatureW * lerp(1.1, 0.85, postureT);

    // ---- Anchors ----
    const cx = 200; // horizontal center
    const feetY = 430; // feet/base position
    const torsoBaseY = feetY - lerp(10, 50, scaleT); // bottom of torso
    const torsoTopY = torsoBaseY - torsoH;
    const torsoCenterY = (torsoBaseY + torsoTopY) / 2;

    // ---- Colors ----
    const bodyColor = `hsl(${p.bodyHue}, ${p.bodySaturation}%, ${p.bodyLightness}%)`;
    const bodyColorLight = `hsl(${p.bodyHue}, ${Math.min(p.bodySaturation + 10, 100)}%, ${Math.min(p.bodyLightness + 14, 72)}%)`;
    const bodyColorDark = `hsl(${p.bodyHue}, ${p.bodySaturation}%, ${Math.max(p.bodyLightness - 10, 4)}%)`;
    const bellyColor = `hsl(${p.bodyHue}, ${Math.max(p.bodySaturation - 5, 0)}%, ${Math.min(p.bodyLightness + 20, 65)}%)`;
    const glowColor = `hsl(${p.glowHue}, 80%, 55%)`;
    const glowColorDim = `hsl(${p.glowHue}, 60%, 35%)`;

    // ---- Head ----
    const headSizeT = clamp(p.headSize, 0, 1);
    const headR = lerp(12, 45, headSizeT) * lerp(0.7, 1, scaleT);
    // Head position: on top when upright, forward when hunched
    const headCx = cx + lerp(10, 0, postureT); // shifts forward when hunched
    const headCy = torsoTopY - headR * 0.4 + p.headYOffset;

    // ---- Torso path ----
    const torsoPath = drawTorso(cx, torsoBaseY, torsoW, torsoH, p.bodyBlobiness, postureT, rng);

    // ---- Belly ----
    const bellyPath = drawBelly(cx, torsoBaseY, torsoW, torsoH);

    // ---- Head path ----
    const headPath = drawHead(headCx, headCy, headR, headSizeT, p.bodyBlobiness, rng);

    // ---- Neck ----
    const neckWidth = lerp(torsoW * 0.25, torsoW * 0.35, headSizeT);
    const headBottomY = headCy + headR * lerp(0.5, 0.7, headSizeT);
    const neckPath = drawNeck(headCx, headBottomY, cx, torsoTopY + torsoH * 0.08, neckWidth);

    // ---- Eyes ----
    const eyes = eyePositions(clamp(p.eyeCount, 1, 4), headCx, headCy, headR);

    // ---- Mouth ----
    const mouthCx = headCx;
    const mouthCy = headCy + headR * lerp(0.3, 0.45, headSizeT);
    const mouthWidth = headR * lerp(0.5, 1.2, headSizeT);
    const { mouthPath, teeth } = drawMouth(mouthCx, mouthCy, mouthWidth, headSizeT);

    // ---- Limbs ----
    type LimbData = {
      upper: string;
      lower: string;
      jointX: number;
      jointY: number;
      endX: number;
      endY: number;
      thickness: number;
      isArm: boolean;
      side: number;
    };
    const limbs: LimbData[] = [];

    // Determine limb configuration based on limbCount
    // 0: no limbs, 1-2: legs only, 3-4: legs+arms, 5-6: legs+arms+extra
    const hasLegs = p.limbCount >= 1;
    const hasArms = p.limbCount >= 3;
    const hasExtra = p.limbCount >= 5;

    if (hasLegs) {
      // Left leg
      const legStartY = torsoBaseY - torsoH * 0.08;
      const legLen = p.limbLength * lerp(0.7, 1, postureT);
      const legThick = p.limbThickness * 1.2;
      const leftLeg = drawLimbPath(
        cx - torsoW * 0.2, legStartY, 0, legLen, legThick, false, -1, postureT
      );
      limbs.push({ ...leftLeg, thickness: legThick, isArm: false, side: -1 });

      // Right leg
      if (p.limbCount >= 2) {
        const rightLeg = drawLimbPath(
          cx + torsoW * 0.2, legStartY, 0, legLen, legThick, false, 1, postureT
        );
        limbs.push({ ...rightLeg, thickness: legThick, isArm: false, side: 1 });
      }
    }

    if (hasArms) {
      // Arms attach at upper torso
      const armStartY = torsoTopY + torsoH * 0.15;
      const armLen = p.limbLength * 0.85;
      const armThick = p.limbThickness * 0.9;

      const leftArm = drawLimbPath(
        cx - torsoW * 0.45, armStartY, 0, armLen, armThick, true, -1, postureT
      );
      limbs.push({ ...leftArm, thickness: armThick, isArm: true, side: -1 });

      if (p.limbCount >= 4) {
        const rightArm = drawLimbPath(
          cx + torsoW * 0.45, armStartY, 0, armLen, armThick, true, 1, postureT
        );
        limbs.push({ ...rightArm, thickness: armThick, isArm: true, side: 1 });
      }
    }

    if (hasExtra) {
      // Extra pair — mid-torso arms or extra legs
      const extraStartY = torsoTopY + torsoH * 0.4;
      const extraLen = p.limbLength * 0.7;
      const extraThick = p.limbThickness * 0.75;

      const leftExtra = drawLimbPath(
        cx - torsoW * 0.48, extraStartY, 0, extraLen, extraThick, true, -1, postureT
      );
      limbs.push({ ...leftExtra, thickness: extraThick, isArm: true, side: -1 });

      if (p.limbCount >= 6) {
        const rightExtra = drawLimbPath(
          cx + torsoW * 0.48, extraStartY, 0, extraLen, extraThick, true, 1, postureT
        );
        limbs.push({ ...rightExtra, thickness: extraThick, isArm: true, side: 1 });
      }
    }

    // ---- Claws ----
    const limbClaws: { paths: string[]; endX: number; endY: number }[] = [];
    for (const limb of limbs) {
      const angle = Math.atan2(limb.endY - limb.jointY, limb.endX - limb.jointX);
      const claws = drawClaws(limb.endX, limb.endY, p.clawSize, angle, limb.side, limb.isArm);
      limbClaws.push({ paths: claws, endX: limb.endX, endY: limb.endY });
    }

    // ---- Tail ----
    const tailStartX = cx + torsoW * 0.15;
    const tailStartY = torsoBaseY - torsoH * 0.05;
    const tailPath = drawTail(tailStartX, tailStartY, p.tailLength, p.tailCurve);

    // ---- Spines ----
    const spines: string[] = [];
    if (p.spineCount > 0) {
      for (let i = 0; i < p.spineCount; i++) {
        const frac = (i + 0.5) / p.spineCount;
        // Distribute spines along the back (top-left contour of body + head)
        let baseX: number, baseY: number, angle: number;
        if (frac < 0.4) {
          // Head spines
          const headFrac = frac / 0.4;
          const a = -Math.PI * 0.8 + headFrac * Math.PI * 0.6;
          baseX = headCx + Math.cos(a) * headR * 0.85;
          baseY = headCy + Math.sin(a) * headR * 0.75;
          angle = a;
        } else {
          // Back spines
          const backFrac = (frac - 0.4) / 0.6;
          baseX = cx - torsoW * lerp(0.3, 0.1, backFrac);
          baseY = torsoTopY + torsoH * backFrac * 0.7;
          angle = -Math.PI * 0.5 - Math.PI * 0.15 * (1 - backFrac);
        }
        spines.push(drawSpine(baseX, baseY, p.spineLength, angle));
      }
    }

    // ---- Fur ----
    const furTufts = drawFurTufts(cx, torsoBaseY, torsoW, torsoH, p.furDensity, rng);

    // ---- Synergy helpers ----
    const hasSynergy = (name: string) => p.activeSynergyVisuals.includes(name);

    // ---- Personality trait levels ----
    const aggrLvl = p.aggressionLevel ?? 0;
    const lumiLvl = p.luminosityLevel ?? 0;
    const toxiLvl = p.toxicityLevel ?? 0;
    const inteLvl = p.intelligenceLevel ?? 0;
    const armoLvl = p.armoringLevel ?? 0;

    // ---- Luminosity: glowing spots on body ----
    const lumiSpots: { cx: number; cy: number; r: number }[] = [];
    if (lumiLvl > 0.2) {
      const spotCount = Math.round(lerp(3, 6, (lumiLvl - 0.2) / 0.8));
      const spotRng = makeRng((fixedSeed ?? 42) + 777);
      for (let i = 0; i < spotCount; i++) {
        const angle = spotRng() * Math.PI * 2;
        const dist = spotRng() * 0.35;
        lumiSpots.push({
          cx: cx + Math.cos(angle) * torsoW * dist,
          cy: torsoCenterY + Math.sin(angle) * torsoH * dist,
          r: 2 + spotRng() * 4 * lumiLvl,
        });
      }
    }

    // ---- Luminosity: glowing veins ----
    const lumiVeins: string[] = [];
    if (lumiLvl > 0.4) {
      const veinRng = makeRng((fixedSeed ?? 42) + 888);
      const veinCount = Math.round(lerp(2, 5, (lumiLvl - 0.4) / 0.6));
      for (let i = 0; i < veinCount; i++) {
        const startAngle = veinRng() * Math.PI * 2;
        const startDist = 0.15 + veinRng() * 0.2;
        const sx = cx + Math.cos(startAngle) * torsoW * startDist;
        const sy = torsoCenterY + Math.sin(startAngle) * torsoH * startDist;
        const ex = cx + Math.cos(startAngle) * torsoW * (startDist + 0.15 + veinRng() * 0.15);
        const ey = torsoCenterY + Math.sin(startAngle) * torsoH * (startDist + 0.15 + veinRng() * 0.15);
        const cpx = (sx + ex) / 2 + (veinRng() - 0.5) * 10;
        const cpy = (sy + ey) / 2 + (veinRng() - 0.5) * 10;
        lumiVeins.push(`M ${f1(sx)} ${f1(sy)} Q ${f1(cpx)} ${f1(cpy)} ${f1(ex)} ${f1(ey)}`);
      }
    }

    // ---- Toxicity: pustules on body ----
    const toxPustules: { cx: number; cy: number; r: number }[] = [];
    if (toxiLvl > 0.2) {
      const pustCount = Math.round(lerp(3, 8, (toxiLvl - 0.2) / 0.8));
      const pustRng = makeRng((fixedSeed ?? 42) + 555);
      for (let i = 0; i < pustCount; i++) {
        const angle = pustRng() * Math.PI * 2;
        const dist = 0.1 + pustRng() * 0.35;
        toxPustules.push({
          cx: cx + Math.cos(angle) * torsoW * dist,
          cy: torsoCenterY + Math.sin(angle) * torsoH * dist,
          r: 1.5 + pustRng() * 3 * toxiLvl,
        });
      }
    }

    // ---- Toxicity: drip paths from mouth/body ----
    const toxDrips: { sx: number; sy: number; ey: number }[] = [];
    if (toxiLvl > 0.4) {
      const dripCount = Math.round(lerp(2, 3, (toxiLvl - 0.4) / 0.6));
      const dripRng = makeRng((fixedSeed ?? 42) + 666);
      for (let i = 0; i < dripCount; i++) {
        const dx = (dripRng() - 0.5) * headR * 1.2;
        toxDrips.push({
          sx: headCx + dx,
          sy: headCy + headR * 0.6,
          ey: headCy + headR * 0.6 + 10 + dripRng() * 20 * toxiLvl,
        });
      }
    }

    // ---- Armoring: plate shapes on torso ----
    const armorPlates: { cx: number; cy: number; rx: number; ry: number; angle: number }[] = [];
    if (armoLvl > 0.2) {
      const plateCount = Math.round(lerp(2, 4, (armoLvl - 0.2) / 0.8));
      const plateRng = makeRng((fixedSeed ?? 42) + 333);
      for (let i = 0; i < plateCount; i++) {
        const yFrac = 0.2 + plateRng() * 0.6;
        const xOff = (plateRng() - 0.5) * torsoW * 0.5;
        armorPlates.push({
          cx: cx + xOff,
          cy: torsoTopY + torsoH * yFrac,
          rx: 6 + plateRng() * 8 * armoLvl,
          ry: 4 + plateRng() * 5 * armoLvl,
          angle: (plateRng() - 0.5) * 30,
        });
      }
    }

    // ---- Armoring: limb plates ----
    const armorLimbPlates: { cx: number; cy: number; w: number; h: number }[] = [];
    if (armoLvl > 0.4 && limbs.length > 0) {
      const lPlateRng = makeRng((fixedSeed ?? 42) + 444);
      for (const limb of limbs) {
        const mx = (limb.jointX + limb.endX) / 2;
        const my = (limb.jointY + limb.endY) / 2;
        armorLimbPlates.push({
          cx: mx,
          cy: my,
          w: 4 + lPlateRng() * 4 * armoLvl,
          h: 3 + lPlateRng() * 3 * armoLvl,
        });
      }
    }

    // ---- Intelligence: neural crown pattern ----
    const intelCrownLines: string[] = [];
    if (inteLvl > 0.5) {
      const crownRng = makeRng((fixedSeed ?? 42) + 999);
      const lineCount = Math.round(lerp(3, 6, (inteLvl - 0.5) / 0.5));
      for (let i = 0; i < lineCount; i++) {
        const angle = -Math.PI * 0.8 + (i / (lineCount - 1)) * Math.PI * 0.6;
        const baseX = headCx + Math.cos(angle) * headR * 0.85;
        const baseY = headCy + Math.sin(angle) * headR * 0.85;
        const tipX = headCx + Math.cos(angle) * headR * (1.1 + crownRng() * 0.2);
        const tipY = headCy + Math.sin(angle) * headR * (1.1 + crownRng() * 0.2);
        intelCrownLines.push(`M ${f1(baseX)} ${f1(baseY)} L ${f1(tipX)} ${f1(tipY)}`);
      }
    }

    // ---- Combat / Warrior Phase visuals ----
    const combatPhaseVal = p.combatPhase ?? 0;
    const attackGlowVal = p.attackGlow ?? 0;
    const defensePatchesVal = p.defensePatches ?? 0;
    const speedLinesVal = p.speedLines ?? 0;
    const muscleDefVal = p.muscleDefinition ?? 0;
    const scarCountVal = p.scarCount ?? 0;
    const specialAuraVal = p.specialAuraIntensity ?? 0;

    // Battle scars: jagged diagonal lines on body and head
    const battleScarPaths: { path: string; onHead: boolean }[] = [];
    if (scarCountVal > 0) {
      const scarRng = makeRng((fixedSeed ?? 42) + 1111);
      for (let i = 0; i < scarCountVal; i++) {
        const onHead = i < Math.ceil(scarCountVal * 0.3);
        const regionCx = onHead ? headCx : cx;
        const regionCy = onHead ? headCy : torsoCenterY;
        const regionW = onHead ? headR * 0.7 : torsoW * 0.4;
        const regionH = onHead ? headR * 0.5 : torsoH * 0.35;

        const startX = regionCx + (scarRng() - 0.5) * regionW * 2;
        const startY = regionCy + (scarRng() - 0.5) * regionH * 2;
        const scarLen = 6 + scarRng() * 14;
        const scarAngle = (scarRng() - 0.5) * Math.PI * 0.8;

        // Jagged scar: 2-3 segments
        const segments = 2 + Math.floor(scarRng() * 2);
        let d = `M ${f1(startX)} ${f1(startY)}`;
        let curX = startX;
        let curY = startY;
        for (let s = 0; s < segments; s++) {
          const segLen = scarLen / segments;
          const jag = (scarRng() - 0.5) * 4;
          curX += Math.cos(scarAngle) * segLen + jag;
          curY += Math.sin(scarAngle) * segLen + (scarRng() - 0.5) * 3;
          d += ` L ${f1(curX)} ${f1(curY)}`;
        }
        battleScarPaths.push({ path: d, onHead });
      }
    }

    // Muscle definition lines: curved lines on torso following body contour
    const muscleLines: string[] = [];
    if (muscleDefVal > 0.2) {
      const muscRng = makeRng((fixedSeed ?? 42) + 2222);
      const lineCount2 = Math.round(lerp(3, 5, (muscleDefVal - 0.2) / 0.8));
      for (let i = 0; i < lineCount2; i++) {
        const yFrac = 0.2 + (i / lineCount2) * 0.6;
        const yPos = torsoTopY + torsoH * yFrac;
        const xSpread = torsoW * lerp(0.2, 0.4, yFrac);
        const curveMag = (muscRng() - 0.3) * 6;
        muscleLines.push(
          `M ${f1(cx - xSpread)} ${f1(yPos)} Q ${f1(cx)} ${f1(yPos + curveMag)} ${f1(cx + xSpread)} ${f1(yPos)}`
        );
      }
    }

    // Defense patches: thicker darkened armor plates (distinct from regular armoring)
    const combatDefensePlates: { cx: number; cy: number; rx: number; ry: number; angle: number }[] = [];
    if (defensePatchesVal > 0 && combatPhaseVal > 0.3) {
      const defRng = makeRng((fixedSeed ?? 42) + 3333);
      for (let i = 0; i < defensePatchesVal; i++) {
        const yFrac = 0.15 + defRng() * 0.65;
        const xOff = (defRng() - 0.5) * torsoW * 0.6;
        combatDefensePlates.push({
          cx: cx + xOff,
          cy: torsoTopY + torsoH * yFrac,
          rx: 8 + defRng() * 10,
          ry: 5 + defRng() * 7,
          angle: (defRng() - 0.5) * 40,
        });
      }
    }

    // Speed lines: horizontal streaks behind the creature
    const speedLinePaths: { path: string; opacity: number }[] = [];
    if (speedLinesVal > 0.2 && combatPhaseVal > 0) {
      const speedRng = makeRng((fixedSeed ?? 42) + 4444);
      const lineCountS = Math.round(lerp(3, 5, speedLinesVal));
      for (let i = 0; i < lineCountS; i++) {
        const yPos = torsoTopY + torsoH * (0.15 + (i / lineCountS) * 0.7);
        const startX2 = cx + torsoW * 0.5 + 5 + speedRng() * 10;
        const endX2 = startX2 + 15 + speedRng() * 25 * speedLinesVal;
        const opacity2 = lerp(0.15, 0.4, speedLinesVal) * (1 - i * 0.15);
        speedLinePaths.push({
          path: `M ${f1(startX2)} ${f1(yPos)} L ${f1(endX2)} ${f1(yPos)}`,
          opacity: Math.max(0.05, opacity2),
        });
      }
    }

    return {
      id,
      p,
      cx,
      feetY,
      torsoBaseY,
      torsoTopY,
      torsoCenterY,
      torsoW,
      torsoH,
      torsoPath,
      bellyPath,
      headCx,
      headCy,
      headR,
      headPath,
      headSizeT,
      neckPath,
      neckWidth,
      eyes,
      mouthPath,
      teeth,
      mouthCy,
      limbs,
      limbClaws,
      tailPath,
      tailStartX,
      tailStartY,
      spines,
      furTufts,
      bodyColor,
      bodyColorLight,
      bodyColorDark,
      bellyColor,
      glowColor,
      glowColorDim,
      postureT,
      scaleT,
      hasSynergy,
      // Personality trait data
      aggrLvl,
      lumiLvl,
      toxiLvl,
      inteLvl,
      armoLvl,
      lumiSpots,
      lumiVeins,
      toxPustules,
      toxDrips,
      armorPlates,
      armorLimbPlates,
      intelCrownLines,
      // Warrior phase
      combatPhaseVal,
      attackGlowVal,
      defensePatchesVal,
      speedLinesVal,
      muscleDefVal,
      scarCountVal,
      specialAuraVal,
      battleScarPaths,
      muscleLines,
      combatDefensePlates,
      speedLinePaths,
    };
  }, [params, instanceId, fixedSeed]);

  const {
    id, p, cx, torsoBaseY, torsoTopY, torsoCenterY, torsoW, torsoH,
    torsoPath, bellyPath, headCx, headCy, headR, headPath, headSizeT,
    neckPath, eyes, mouthPath, teeth, mouthCy, limbs, limbClaws,
    tailPath, tailStartX, tailStartY, spines, furTufts,
    bodyColor, bodyColorLight, bodyColorDark, bellyColor,
    glowColor, glowColorDim, postureT, hasSynergy,
    // Personality traits
    aggrLvl, lumiLvl, toxiLvl, inteLvl, armoLvl,
    lumiSpots, lumiVeins, toxPustules, toxDrips,
    armorPlates, armorLimbPlates, intelCrownLines,
    // Warrior phase
    combatPhaseVal, attackGlowVal, speedLinesVal,
    muscleDefVal, scarCountVal, specialAuraVal,
    battleScarPaths, muscleLines, combatDefensePlates, speedLinePaths,
  } = svg;

  const anim = animated;
  const hasSangue = hasSynergy("blood_red");
  const hasVeleno = hasSynergy("toxic_green");
  const hasNeural = hasSynergy("neural_glow");
  const hasOssatura = hasSynergy("skeletal");
  const hasOrganico = hasSynergy("organic_harmony");
  const hasCaotico = hasSynergy("chaos_shimmer");

  return (
    <svg
      viewBox="0 0 400 500"
      width={size}
      height={size * 1.25}
      className={className}
      role="img"
      aria-label="Creature"
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* Body gradient */}
        <radialGradient id={id("body-grad")} cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor={bodyColorLight} stopOpacity={0.95} />
          <stop offset="50%" stopColor={bodyColor} stopOpacity={0.9} />
          <stop offset="100%" stopColor={bodyColorDark} stopOpacity={1} />
        </radialGradient>

        {/* Belly gradient */}
        <radialGradient id={id("belly-grad")} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={bellyColor} stopOpacity={0.6} />
          <stop offset="100%" stopColor={bodyColor} stopOpacity={0.2} />
        </radialGradient>

        {/* Head gradient */}
        <radialGradient id={id("head-grad")} cx="42%" cy="35%" r="65%">
          <stop offset="0%" stopColor={bodyColorLight} stopOpacity={0.9} />
          <stop offset="60%" stopColor={bodyColor} stopOpacity={0.85} />
          <stop offset="100%" stopColor={bodyColorDark} stopOpacity={0.95} />
        </radialGradient>

        {/* Limb gradient */}
        <linearGradient id={id("limb-grad")} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={bodyColor} />
          <stop offset="100%" stopColor={bodyColorDark} />
        </linearGradient>

        {/* Spine gradient */}
        <linearGradient id={id("spine-grad")} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={p.spineColor || bodyColorDark} />
          <stop offset="100%" stopColor={p.spineColor || bodyColorLight} stopOpacity={0.7} />
        </linearGradient>

        {/* Claw gradient */}
        <linearGradient id={id("claw-grad")} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.clawColor || bodyColorLight} />
          <stop offset="100%" stopColor={p.toothColor || "#e8e0d4"} stopOpacity={0.9} />
        </linearGradient>

        {/* Iris gradient */}
        <radialGradient id={id("iris-grad")} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor={p.eyeColor} stopOpacity={1} />
          <stop offset="50%" stopColor={p.eyeColor} stopOpacity={0.85} />
          <stop offset="80%" stopColor={bodyColorDark} stopOpacity={0.6} />
          <stop offset="100%" stopColor="#0a0a12" stopOpacity={0.9} />
        </radialGradient>

        {/* Aura gradients */}
        <radialGradient id={id("glow-outer")}>
          <stop offset="0%" stopColor={glowColorDim} stopOpacity={p.glowIntensity * 0.15} />
          <stop offset="100%" stopColor={glowColorDim} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={id("glow-inner")}>
          <stop offset="0%" stopColor={glowColor} stopOpacity={p.glowIntensity * 0.5} />
          <stop offset="50%" stopColor={glowColor} stopOpacity={p.glowIntensity * 0.15} />
          <stop offset="100%" stopColor={glowColor} stopOpacity={0} />
        </radialGradient>

        {/* Tooth gradient */}
        <linearGradient id={id("tooth-grad")} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={p.toothColor || "#f0ece4"} />
          <stop offset="100%" stopColor={p.toothColor || "#c8c0b0"} stopOpacity={0.8} />
        </linearGradient>

        {/* Organic shimmer for synergy */}
        {hasOrganico && (
          <linearGradient id={id("shimmer-grad")} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(0, 80%, 60%)" stopOpacity={0.12} />
            <stop offset="33%" stopColor="hsl(120, 80%, 60%)" stopOpacity={0.12} />
            <stop offset="66%" stopColor="hsl(240, 80%, 60%)" stopOpacity={0.12} />
            <stop offset="100%" stopColor="hsl(360, 80%, 60%)" stopOpacity={0.12} />
          </linearGradient>
        )}

        {/* ======= FILTERS ======= */}

        {/* Eye glow */}
        <filter id={id("eye-glow")} x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={3 + p.eyeGlow * 5} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Skin texture displacement */}
        <filter id={id("skin-tex")} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency={0.012 + p.skinRoughness * 0.025}
            numOctaves={3}
            seed={Math.round(p.bodyHue * 10)}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic" in2="noise"
            scale={2 + p.skinRoughness * 5}
            xChannelSelector="R" yChannelSelector="G"
          />
        </filter>

        {/* Rough overlay for skinRoughness > 0.3 */}
        {p.skinRoughness > 0.3 && (
          <filter id={id("rough-overlay")} x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="turbulence" baseFrequency={0.04 + p.skinRoughness * 0.05}
              numOctaves={4} seed={Math.round(p.bodyHue * 7 + 42)} result="rn" />
            <feColorMatrix in="rn" type="saturate" values="0" result="gn" />
            <feBlend in="SourceGraphic" in2="gn" mode="overlay" />
          </filter>
        )}

        {/* Aura blur */}
        <filter id={id("aura-blur")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="18" />
        </filter>
        <filter id={id("aura-blur-sm")} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
        </filter>

        {/* Spine glow */}
        <filter id={id("spine-glow")} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Chaos filter */}
        {hasCaotico && (
          <filter id={id("chaos-filter")} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="turbulence" baseFrequency="0.02 0.06" numOctaves={2} seed={99}
              result="cn" />
            <feDisplacementMap in="SourceGraphic" in2="cn" scale={6}
              xChannelSelector="R" yChannelSelector="G" />
          </filter>
        )}

        {/* Clip paths */}
        <clipPath id={id("torso-clip")}>
          <path d={torsoPath} />
        </clipPath>
        <clipPath id={id("head-clip")}>
          <path d={headPath} />
        </clipPath>
      </defs>

      {/* Float animation wrapper */}
      <g style={anim ? { animation: "float 4s ease-in-out infinite" } : undefined}>
        {/* Chaos shimmer wrapper */}
        <g
          filter={hasCaotico ? `url(#${id("chaos-filter")})` : undefined}
          style={hasCaotico && anim ? { animation: "glitch 0.8s steps(4) infinite" } : undefined}
        >

        {/* Aggression tilt wrapper */}
        <g transform={aggrLvl > 0.3 ? `rotate(${-lerp(5, 15, (aggrLvl - 0.3) / 0.7)}, ${cx}, ${torsoCenterY})` : undefined}>

          {/* ==================== AURA / GLOW ==================== */}
          {p.glowIntensity > 0.02 && (
            <g>
              <ellipse cx={cx} cy={torsoCenterY} rx={torsoW * 1.8} ry={torsoH * 1.2}
                fill={`url(#${id("glow-outer")})`} filter={`url(#${id("aura-blur")})`}
                style={anim ? {
                  animation: "pulse-glow 4s ease-in-out infinite",
                  transformOrigin: `${cx}px ${torsoCenterY}px`,
                } : undefined}
              />
              <ellipse cx={cx} cy={torsoCenterY} rx={torsoW * 1.1} ry={torsoH * 0.8}
                fill={`url(#${id("glow-inner")})`} filter={`url(#${id("aura-blur-sm")})`}
                style={anim ? {
                  animation: "pulse-glow 3s ease-in-out 0.5s infinite",
                  transformOrigin: `${cx}px ${torsoCenterY}px`,
                } : undefined}
              />
            </g>
          )}

          {/* ==================== TAIL ==================== */}
          {tailPath && (
            <g style={anim ? {
              animation: "tail-sway 5s ease-in-out infinite",
              transformOrigin: `${tailStartX}px ${tailStartY}px`,
            } : undefined}>
              {/* Tail glow */}
              <path d={tailPath} fill="none" stroke={glowColor}
                strokeWidth={p.limbThickness * 1.5} strokeLinecap="round" opacity={0.1}
                filter={`url(#${id("aura-blur-sm")})`} />
              {/* Tail body — tapers */}
              <path d={tailPath} fill="none" stroke={p.tailColor || bodyColor}
                strokeWidth={p.limbThickness * 1.1} strokeLinecap="round"
                opacity={p.bodyOpacity * 0.9} />
              {/* Tail highlight */}
              <path d={tailPath} fill="none" stroke={bodyColorLight}
                strokeWidth={p.limbThickness * 0.3} strokeLinecap="round" opacity={0.25} />
            </g>
          )}

          {/* ==================== LIMBS (behind body) ==================== */}
          {limbs.map((limb, i) => (
            <g key={`limb-${i}`}>
              {/* Upper segment */}
              <path d={limb.upper} fill="none" stroke={`url(#${id("limb-grad")})`}
                strokeWidth={limb.thickness * 1.3} strokeLinecap="round"
                opacity={p.bodyOpacity * 0.95} />
              {/* Upper highlight */}
              <path d={limb.upper} fill="none" stroke={bodyColorLight}
                strokeWidth={limb.thickness * 0.35} strokeLinecap="round" opacity={0.2} />

              {/* Joint circle */}
              <circle cx={limb.jointX} cy={limb.jointY} r={limb.thickness * 0.8}
                fill={bodyColorDark} opacity={p.bodyOpacity * 0.85} />
              <circle cx={limb.jointX} cy={limb.jointY} r={limb.thickness * 0.55}
                fill={bodyColor} opacity={0.5} />

              {/* Lower segment — slightly thinner */}
              <path d={limb.lower} fill="none" stroke={`url(#${id("limb-grad")})`}
                strokeWidth={limb.thickness * 1.0} strokeLinecap="round"
                opacity={p.bodyOpacity * 0.9} />
              <path d={limb.lower} fill="none" stroke={bodyColorLight}
                strokeWidth={limb.thickness * 0.25} strokeLinecap="round" opacity={0.18} />

              {/* Foot/hand nub */}
              {p.clawSize < 1 && (
                <circle cx={limb.endX} cy={limb.endY} r={limb.thickness * 0.7}
                  fill={bodyColorDark} opacity={p.bodyOpacity * 0.8} />
              )}

              {/* Claws */}
              {limbClaws[i] && limbClaws[i].paths.map((claw, ci) => (
                <path key={`claw-${i}-${ci}`} d={claw} fill="none"
                  stroke={`url(#${id("claw-grad")})`}
                  strokeWidth={lerp(1.5, 3, p.clawSize / 12)}
                  strokeLinecap="round" opacity={0.85} />
              ))}
            </g>
          ))}

          {/* ==================== SPINES ==================== */}
          {spines.map((spinePath, i) => (
            <g key={`spine-${i}`}>
              <path d={spinePath} fill={glowColor} opacity={0.08}
                filter={`url(#${id("spine-glow")})`} />
              <path d={spinePath} fill={`url(#${id("spine-grad")})`}
                opacity={p.bodyOpacity * 0.85} />
            </g>
          ))}

          {/* ==================== TORSO ==================== */}
          <g style={anim ? {
            animation: "breathe 3s ease-in-out infinite",
            transformOrigin: `${cx}px ${torsoCenterY}px`,
          } : undefined}>
            {/* Main body fill */}
            <path d={torsoPath} fill={`url(#${id("body-grad")})`}
              opacity={p.bodyOpacity} filter={`url(#${id("skin-tex")})`}
              stroke={bodyColorDark} strokeWidth={0.6} />

            {/* Rough texture overlay */}
            {p.skinRoughness > 0.3 && (
              <path d={torsoPath} fill={bodyColor} opacity={0.12}
                filter={`url(#${id("rough-overlay")})`} />
            )}

            {/* Belly highlight */}
            <path d={bellyPath} fill={`url(#${id("belly-grad")})`} opacity={0.4} />

            {/* Organic harmony shimmer */}
            {hasOrganico && (
              <path d={torsoPath} fill={`url(#${id("shimmer-grad")})`} opacity={0.25}
                style={anim ? { animation: "shimmer 3s linear infinite" } : undefined} />
            )}

            {/* Ossatura synergy: internal bone lines */}
            {hasOssatura && (
              <g clipPath={`url(#${id("torso-clip")})`} opacity={0.2}>
                <line x1={cx} y1={torsoTopY + torsoH * 0.1} x2={cx} y2={torsoBaseY - torsoH * 0.05}
                  stroke="hsl(40, 20%, 80%)" strokeWidth={2.5} strokeLinecap="round" />
                <line x1={cx - torsoW * 0.3} y1={torsoCenterY - torsoH * 0.1}
                  x2={cx + torsoW * 0.3} y2={torsoCenterY - torsoH * 0.1}
                  stroke="hsl(40, 20%, 75%)" strokeWidth={1.8} strokeLinecap="round" />
                <line x1={cx - torsoW * 0.2} y1={torsoCenterY + torsoH * 0.15}
                  x2={cx + torsoW * 0.2} y2={torsoCenterY + torsoH * 0.15}
                  stroke="hsl(40, 20%, 70%)" strokeWidth={1.5} strokeLinecap="round" />
              </g>
            )}

            {/* Blood red synergy: pulsing veins */}
            {hasSangue && anim && (
              <g clipPath={`url(#${id("torso-clip")})`} opacity={0.3}>
                <line x1={cx - torsoW * 0.3} y1={torsoCenterY - torsoH * 0.2}
                  x2={cx + torsoW * 0.1} y2={torsoCenterY + torsoH * 0.3}
                  stroke="hsl(0, 80%, 40%)" strokeWidth={1.2} strokeLinecap="round"
                  style={{ animation: "pulse-glow 2s ease-in-out infinite" }} />
                <line x1={cx + torsoW * 0.25} y1={torsoCenterY - torsoH * 0.15}
                  x2={cx - torsoW * 0.1} y2={torsoCenterY + torsoH * 0.25}
                  stroke="hsl(0, 75%, 35%)" strokeWidth={1} strokeLinecap="round"
                  style={{ animation: "pulse-glow 2s ease-in-out 0.5s infinite" }} />
              </g>
            )}

            {/* Edge highlight */}
            <path d={torsoPath} fill="none" stroke={bodyColorLight}
              strokeWidth={0.8} opacity={0.15} />

            {/* ==================== AGGRESSION: red tint overlay ==================== */}
            {aggrLvl > 0.7 && (
              <path d={torsoPath} fill="hsl(0, 80%, 40%)"
                opacity={lerp(0, 0.15, (aggrLvl - 0.7) / 0.3)} />
            )}

            {/* ==================== AGGRESSION: furrowed brow lines (on torso for body tension) ==================== */}

            {/* ==================== ARMORING: torso plates ==================== */}
            {armorPlates.length > 0 && (
              <g clipPath={`url(#${id("torso-clip")})`} opacity={0.6}>
                {armorPlates.map((plate, i) => (
                  <ellipse
                    key={`armor-plate-${i}`}
                    cx={plate.cx}
                    cy={plate.cy}
                    rx={plate.rx}
                    ry={plate.ry}
                    transform={`rotate(${plate.angle}, ${plate.cx}, ${plate.cy})`}
                    fill={bodyColorDark}
                    stroke={bodyColorLight}
                    strokeWidth={0.6}
                    opacity={0.55 + armoLvl * 0.3}
                  />
                ))}
              </g>
            )}

            {/* ==================== ARMORING: thick body outline ==================== */}
            {armoLvl > 0.6 && (
              <path d={torsoPath} fill="none" stroke={bodyColorDark}
                strokeWidth={lerp(1.5, 3.5, (armoLvl - 0.6) / 0.4)} opacity={0.5} />
            )}

            {/* ==================== LUMINOSITY: glowing spots ==================== */}
            {lumiSpots.length > 0 && (
              <g filter={`url(#${id("aura-blur-sm")})`}>
                {lumiSpots.map((spot, i) => (
                  <circle
                    key={`lumi-spot-${i}`}
                    cx={spot.cx}
                    cy={spot.cy}
                    r={spot.r}
                    fill={glowColor}
                    opacity={0.3 + lumiLvl * 0.4}
                    style={anim ? {
                      animation: `pulse-glow ${2 + i * 0.5}s ease-in-out ${i * 0.3}s infinite`,
                    } : undefined}
                  />
                ))}
              </g>
            )}

            {/* ==================== LUMINOSITY: glowing veins ==================== */}
            {lumiVeins.length > 0 && (
              <g clipPath={`url(#${id("torso-clip")})`}>
                {lumiVeins.map((vein, i) => (
                  <path
                    key={`lumi-vein-${i}`}
                    d={vein}
                    fill="none"
                    stroke={glowColor}
                    strokeWidth={1 + lumiLvl}
                    strokeLinecap="round"
                    opacity={0.25 + lumiLvl * 0.35}
                    filter={`url(#${id("eye-glow")})`}
                    style={anim ? {
                      animation: `pulse-glow ${2.5 + i * 0.4}s ease-in-out ${i * 0.5}s infinite`,
                    } : undefined}
                  />
                ))}
              </g>
            )}

            {/* ==================== TOXICITY: pustules ==================== */}
            {toxPustules.length > 0 && (
              <g clipPath={`url(#${id("torso-clip")})`}>
                {toxPustules.map((pust, i) => (
                  <g key={`pust-${i}`}>
                    <circle cx={pust.cx} cy={pust.cy} r={pust.r}
                      fill="hsl(90, 60%, 30%)" opacity={0.6 + toxiLvl * 0.2} />
                    <circle cx={pust.cx} cy={pust.cy} r={pust.r * 0.6}
                      fill="hsl(80, 70%, 45%)" opacity={0.5} />
                    <circle cx={pust.cx - pust.r * 0.2} cy={pust.cy - pust.r * 0.2} r={pust.r * 0.2}
                      fill="hsl(90, 40%, 60%)" opacity={0.5} />
                  </g>
                ))}
              </g>
            )}

            {/* ==================== TOXICITY: green mist ==================== */}
            {toxiLvl > 0.6 && (
              <ellipse cx={cx} cy={torsoCenterY}
                rx={torsoW * 1.3} ry={torsoH * 0.9}
                fill="hsl(110, 70%, 40%)"
                opacity={lerp(0, 0.08, (toxiLvl - 0.6) / 0.4)}
                filter={`url(#${id("aura-blur")})`} />
            )}
          </g>

          {/* ==================== FUR ==================== */}
          {furTufts.length > 0 && (
            <g opacity={Math.min(1, 0.4 + p.furDensity * 0.7)}>
              {furTufts.map((tuft, i) => {
                // Vary lightness slightly for depth: some strands darker, some lighter
                const lightnessShift = (i % 5) - 2; // -2 to +2
                const furStroke = lightnessShift === 0
                  ? (p.furColor || bodyColorLight)
                  : lightnessShift > 0
                    ? (bodyColorLight)
                    : (bodyColorDark);
                return (
                  <path
                    key={`fur-${i}`}
                    d={tuft.path}
                    fill="none"
                    stroke={furStroke}
                    strokeWidth={tuft.width}
                    strokeLinecap="round"
                    opacity={tuft.opacity}
                  />
                );
              })}
            </g>
          )}

          {/* ==================== NECK + HEAD ==================== */}
          <g>
            {/* Neck */}
            <path d={neckPath} fill={bodyColor} opacity={p.bodyOpacity * 0.75}
              stroke={bodyColorDark} strokeWidth={0.3} />

            {/* Head */}
            <path d={headPath} fill={`url(#${id("head-grad")})`}
              opacity={p.bodyOpacity * 0.9} filter={`url(#${id("skin-tex")})`}
              stroke={bodyColorDark} strokeWidth={0.4} />

            {/* Head highlight rim */}
            <path d={headPath} fill="none" stroke={bodyColorLight}
              strokeWidth={0.5} opacity={0.12} />

            {/* Neural synergy: electric arcs */}
            {hasNeural && anim && (
              <g opacity={0.5}>
                <line x1={headCx - headR * 0.8} y1={headCy - headR * 0.3}
                  x2={headCx - headR * 1.3} y2={headCy - headR * 0.8}
                  stroke="hsl(260, 100%, 75%)" strokeWidth={1} strokeLinecap="round"
                  style={{ animation: "spark 0.6s steps(2) infinite" }} />
                <line x1={headCx + headR * 0.8} y1={headCy - headR * 0.2}
                  x2={headCx + headR * 1.4} y2={headCy - headR * 0.7}
                  stroke="hsl(270, 100%, 80%)" strokeWidth={0.8} strokeLinecap="round"
                  style={{ animation: "spark 0.6s steps(2) 0.2s infinite" }} />
              </g>
            )}

            {/* ==================== MOUTH ==================== */}
            {mouthPath && (
              <g>
                {/* Mouth interior */}
                <path d={mouthPath} fill="hsl(0, 30%, 15%)" opacity={0.8}
                  stroke={bodyColorDark} strokeWidth={0.5} />
                {/* Teeth */}
                {teeth.map((t, i) => (
                  <path key={`tooth-${i}`} d={t} fill={`url(#${id("tooth-grad")})`}
                    opacity={0.9} stroke={bodyColorDark} strokeWidth={0.2} />
                ))}
              </g>
            )}
          </g>

          {/* ==================== EYES ==================== */}
          {eyes.map((eye, i) =>
            drawEyeSvg(
              eye.x, eye.y, p.eyeSize, p.eyeColor, p.pupilShape,
              p.bodyHue, bodyColorDark, id("iris-grad"), id("eye-glow"),
              p.eyeGlow, glowColor, anim, 4 + i * 1.5, i,
            )
          )}

          {/* ==================== AGGRESSION: furrowed brow lines above eyes ==================== */}
          {aggrLvl > 0.5 && eyes.length >= 2 && (
            <g opacity={lerp(0.3, 0.7, (aggrLvl - 0.5) / 0.5)}>
              {eyes.slice(0, 2).map((eye, i) => {
                const browW = p.eyeSize * 1.2;
                const browY = eye.y - p.eyeSize * 1.1;
                const innerDip = aggrLvl * 3;
                return (
                  <path
                    key={`brow-${i}`}
                    d={`M ${f1(eye.x - browW)} ${f1(browY)} Q ${f1(eye.x)} ${f1(browY + innerDip)} ${f1(eye.x + browW)} ${f1(browY - 1)}`}
                    fill="none"
                    stroke={bodyColorDark}
                    strokeWidth={lerp(0.8, 2, aggrLvl)}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          )}

          {/* ==================== INTELLIGENCE: neural crown on top of head ==================== */}
          {intelCrownLines.length > 0 && (
            <g opacity={0.4 + inteLvl * 0.3}>
              {intelCrownLines.map((line, i) => (
                <path
                  key={`crown-${i}`}
                  d={line}
                  fill="none"
                  stroke={`hsl(${p.glowHue}, 80%, 70%)`}
                  strokeWidth={lerp(0.5, 1.5, inteLvl)}
                  strokeLinecap="round"
                  style={anim ? {
                    animation: `pulse-glow ${2 + i * 0.3}s ease-in-out ${i * 0.2}s infinite`,
                  } : undefined}
                />
              ))}
            </g>
          )}

          {/* ==================== INTELLIGENCE: thought aura above head ==================== */}
          {inteLvl > 0.7 && (
            <circle
              cx={headCx}
              cy={headCy - headR * 1.6}
              r={headR * 0.5}
              fill={`hsl(${p.glowHue}, 60%, 70%)`}
              opacity={lerp(0, 0.1, (inteLvl - 0.7) / 0.3)}
              filter={`url(#${id("aura-blur-sm")})`}
              style={anim ? {
                animation: "pulse-glow 3s ease-in-out infinite",
                transformOrigin: `${headCx}px ${headCy - headR * 1.6}px`,
              } : undefined}
            />
          )}

          {/* ==================== LUMINOSITY: brighter eyes at high levels ==================== */}
          {lumiLvl > 0.6 && eyes.map((eye, i) => (
            <circle
              key={`eye-lumi-${i}`}
              cx={eye.x}
              cy={eye.y}
              r={p.eyeSize * 1.5}
              fill={glowColor}
              opacity={lerp(0, 0.25, (lumiLvl - 0.6) / 0.4)}
              filter={`url(#${id("eye-glow")})`}
            />
          ))}

          {/* ==================== TOXICITY: drip paths from mouth ==================== */}
          {toxDrips.length > 0 && (
            <g>
              {toxDrips.map((drip, i) => (
                <g key={`tox-drip-${i}`}>
                  {/* Drip path */}
                  <line
                    x1={drip.sx} y1={drip.sy}
                    x2={drip.sx + (i % 2 === 0 ? 2 : -2)} y2={drip.ey}
                    stroke="hsl(100, 70%, 45%)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    opacity={0.5 + toxiLvl * 0.3}
                    style={anim ? {
                      animation: `drip ${1.8 + i * 0.4}s ease-in ${i * 0.3}s infinite`,
                    } : undefined}
                  />
                  {/* Drip droplet at end */}
                  <circle
                    cx={drip.sx + (i % 2 === 0 ? 2 : -2)} cy={drip.ey}
                    r={2 + toxiLvl * 1.5}
                    fill="hsl(100, 75%, 40%)"
                    opacity={0.6}
                    style={anim ? {
                      animation: `drip ${1.8 + i * 0.4}s ease-in ${i * 0.3}s infinite`,
                    } : undefined}
                  />
                </g>
              ))}
            </g>
          )}

          {/* ==================== ARMORING: limb plates ==================== */}
          {armorLimbPlates.length > 0 && (
            <g opacity={0.5 + armoLvl * 0.3}>
              {armorLimbPlates.map((plate, i) => (
                <rect
                  key={`limb-plate-${i}`}
                  x={plate.cx - plate.w / 2}
                  y={plate.cy - plate.h / 2}
                  width={plate.w}
                  height={plate.h}
                  rx={1}
                  fill={bodyColorDark}
                  stroke={bodyColorLight}
                  strokeWidth={0.4}
                  opacity={0.6}
                />
              ))}
            </g>
          )}

          {/* ==================== WARRIOR PHASE: BATTLE SCARS ==================== */}
          {scarCountVal > 0 && (
            <g opacity={lerp(0.3, 0.6, scarCountVal / 8)}>
              {battleScarPaths.map((scar, i) => (
                <path
                  key={`scar-${i}`}
                  d={scar.path}
                  fill="none"
                  stroke={bodyColorLight}
                  strokeWidth={lerp(0.8, 1.5, scarCountVal / 8)}
                  strokeLinecap="round"
                  opacity={0.5 + (i % 3) * 0.1}
                />
              ))}
            </g>
          )}

          {/* ==================== WARRIOR PHASE: MUSCLE DEFINITION ==================== */}
          {muscleDefVal > 0.2 && combatPhaseVal > 0 && (
            <g clipPath={`url(#${id("torso-clip")})`} opacity={lerp(0.1, 0.3, muscleDefVal)}>
              {muscleLines.map((line, i) => (
                <path
                  key={`muscle-${i}`}
                  d={line}
                  fill="none"
                  stroke={bodyColorDark}
                  strokeWidth={lerp(0.5, 1.2, muscleDefVal)}
                  strokeLinecap="round"
                  opacity={0.3 + muscleDefVal * 0.4}
                />
              ))}
            </g>
          )}

          {/* ==================== WARRIOR PHASE: DEFENSE PATCHES ==================== */}
          {combatDefensePlates.length > 0 && (
            <g clipPath={`url(#${id("torso-clip")})`} opacity={0.7}>
              {combatDefensePlates.map((plate, i) => (
                <g key={`def-plate-${i}`}>
                  {/* Main plate */}
                  <ellipse
                    cx={plate.cx}
                    cy={plate.cy}
                    rx={plate.rx}
                    ry={plate.ry}
                    transform={`rotate(${plate.angle}, ${plate.cx}, ${plate.cy})`}
                    fill={bodyColorDark}
                    stroke={bodyColorLight}
                    strokeWidth={1}
                    opacity={0.6}
                  />
                  {/* Crack lines within the plate */}
                  <line
                    x1={plate.cx - plate.rx * 0.3}
                    y1={plate.cy - plate.ry * 0.2}
                    x2={plate.cx + plate.rx * 0.4}
                    y2={plate.cy + plate.ry * 0.3}
                    stroke={bodyColorLight}
                    strokeWidth={0.4}
                    opacity={0.3}
                    transform={`rotate(${plate.angle}, ${plate.cx}, ${plate.cy})`}
                  />
                  <line
                    x1={plate.cx + plate.rx * 0.1}
                    y1={plate.cy - plate.ry * 0.4}
                    x2={plate.cx - plate.rx * 0.2}
                    y2={plate.cy + plate.ry * 0.2}
                    stroke={bodyColorLight}
                    strokeWidth={0.3}
                    opacity={0.25}
                    transform={`rotate(${plate.angle}, ${plate.cx}, ${plate.cy})`}
                  />
                </g>
              ))}
            </g>
          )}

          {/* ==================== WARRIOR PHASE: SPEED LINES ==================== */}
          {speedLinesVal > 0.2 && combatPhaseVal > 0 && (
            <g>
              {speedLinePaths.map((sl, i) => (
                <path
                  key={`speed-${i}`}
                  d={sl.path}
                  fill="none"
                  stroke={bodyColorLight}
                  strokeWidth={0.6}
                  strokeLinecap="round"
                  opacity={sl.opacity}
                  strokeDasharray="4 3"
                />
              ))}
            </g>
          )}

          {/* ==================== WARRIOR PHASE: ATTACK GLOW (claws/mouth) ==================== */}
          {attackGlowVal > 0.2 && (
            <g>
              {/* Glow on claw endpoints */}
              {limbClaws.map((lc, i) =>
                lc.paths.length > 0 ? (
                  <circle
                    key={`atk-glow-${i}`}
                    cx={lc.endX}
                    cy={lc.endY}
                    r={p.clawSize * 0.8 + attackGlowVal * 3}
                    fill={glowColor}
                    opacity={attackGlowVal * 0.25}
                    filter={`url(#${id("eye-glow")})`}
                    style={anim ? {
                      animation: `pulse-glow ${2 + i * 0.3}s ease-in-out infinite`,
                      transformOrigin: `${lc.endX}px ${lc.endY}px`,
                    } : undefined}
                  />
                ) : null
              )}
              {/* Glow on mouth when teeth visible */}
              {teeth.length > 0 && (
                <ellipse
                  cx={headCx}
                  cy={mouthCy}
                  rx={headR * 0.4}
                  ry={headR * 0.2}
                  fill={glowColor}
                  opacity={attackGlowVal * 0.15}
                  filter={`url(#${id("eye-glow")})`}
                />
              )}
            </g>
          )}

          {/* ==================== WARRIOR PHASE: SPECIAL ATTACK AURA ==================== */}
          {specialAuraVal > 0.3 && combatPhaseVal > 0 && (
            <g>
              {/* Determine dominant feature for aura placement */}
              {inteLvl > 0.3 ? (
                /* Intelligence: aura around head */
                <ellipse
                  cx={headCx}
                  cy={headCy}
                  rx={headR * 1.6}
                  ry={headR * 1.4}
                  fill={glowColor}
                  opacity={specialAuraVal * 0.12}
                  filter={`url(#${id("aura-blur")})`}
                  style={anim ? {
                    animation: "pulse-glow 2.5s ease-in-out infinite",
                    transformOrigin: `${headCx}px ${headCy}px`,
                  } : undefined}
                />
              ) : toxiLvl > 0.3 ? (
                /* Toxicity: toxic cloud aura around body */
                <ellipse
                  cx={cx}
                  cy={torsoCenterY}
                  rx={torsoW * 1.4}
                  ry={torsoH * 1.0}
                  fill="hsl(110, 70%, 45%)"
                  opacity={specialAuraVal * 0.1}
                  filter={`url(#${id("aura-blur")})`}
                  style={anim ? {
                    animation: "pulse-glow 3s ease-in-out infinite",
                    transformOrigin: `${cx}px ${torsoCenterY}px`,
                  } : undefined}
                />
              ) : aggrLvl > 0.3 ? (
                /* Aggression: aura on claws/limb ends */
                <g>
                  {limbs.slice(0, 2).map((limb, i) => (
                    <circle
                      key={`spec-aura-claw-${i}`}
                      cx={limb.endX}
                      cy={limb.endY}
                      r={12 + specialAuraVal * 8}
                      fill={glowColor}
                      opacity={specialAuraVal * 0.15}
                      filter={`url(#${id("aura-blur-sm")})`}
                      style={anim ? {
                        animation: `pulse-glow ${2 + i * 0.4}s ease-in-out infinite`,
                      } : undefined}
                    />
                  ))}
                </g>
              ) : (
                /* Default: general body aura */
                <ellipse
                  cx={cx}
                  cy={torsoCenterY}
                  rx={torsoW * 1.3}
                  ry={torsoH * 0.9}
                  fill={glowColor}
                  opacity={specialAuraVal * 0.1}
                  filter={`url(#${id("aura-blur")})`}
                  style={anim ? {
                    animation: "pulse-glow 3s ease-in-out infinite",
                    transformOrigin: `${cx}px ${torsoCenterY}px`,
                  } : undefined}
                />
              )}
            </g>
          )}

          {/* ==================== TOXIC DRIP (synergy) ==================== */}
          {hasVeleno && anim && (
            <g>
              {[0, 1, 2, 3].map((i) => {
                const dx = -12 + i * 8;
                return (
                  <circle key={`drip-${i}`} cx={cx + dx} cy={torsoBaseY}
                    r={1.5} fill="hsl(120, 80%, 50%)" opacity={0.6}
                    style={{ animation: `drip ${1.5 + i * 0.3}s ease-in ${i * 0.4}s infinite` }} />
                );
              })}
            </g>
          )}

          {/* ==================== PARTICLES ==================== */}
          <CreatureParticles
            color={glowColor}
            count={Math.round(6 + p.glowIntensity * 6)}
            intensity={Math.max(p.glowIntensity, 0.15)}
          />

        </g>{/* end aggression tilt wrapper */}
        </g>{/* end chaos shimmer wrapper */}
      </g>{/* end float animation wrapper */}
    </svg>
  );
}
