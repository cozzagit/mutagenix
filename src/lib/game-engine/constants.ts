// ---------------------------------------------------------------------------
// Mutagenix – Game Constants
// ---------------------------------------------------------------------------

export const ELEMENTS = [
  'N', 'K', 'Na', 'C', 'O', 'P', 'S', 'Ca', 'Fe', 'Cl',
] as const;
export type ElementId = (typeof ELEMENTS)[number];

export const TRAITS = [
  'bodySize', 'headSize', 'limbGrowth', 'eyeDev', 'skinTex',
  'furDensity', 'spininess', 'tailGrowth', 'clawDev', 'posture',
  'aggression', 'luminosity', 'toxicity', 'intelligence', 'armoring',
] as const;
export type TraitId = (typeof TRAITS)[number];

// ---------------------------------------------------------------------------
// Combat Traits (Warrior Phase)
// ---------------------------------------------------------------------------

export const COMBAT_TRAITS = [
  'attackPower', 'defense', 'speed', 'stamina', 'specialAttack', 'battleScars',
] as const;
export type CombatTraitId = (typeof COMBAT_TRAITS)[number];

// ---------------------------------------------------------------------------
// Element → Trait weight matrix  (unlisted combinations = 0)
// ---------------------------------------------------------------------------

const z = (): Record<TraitId, number> => ({
  bodySize: 0, headSize: 0, limbGrowth: 0, eyeDev: 0, skinTex: 0,
  furDensity: 0, spininess: 0, tailGrowth: 0, clawDev: 0, posture: 0,
  aggression: 0, luminosity: 0, toxicity: 0, intelligence: 0, armoring: 0,
});

// ---------------------------------------------------------------------------
// Element → Combat Trait weight matrix (Warrior Phase)
// ---------------------------------------------------------------------------

const zc = (): Record<CombatTraitId, number> => ({
  attackPower: 0, defense: 0, speed: 0, stamina: 0, specialAttack: 0, battleScars: 0,
});

export const ELEMENT_COMBAT_WEIGHTS: Record<ElementId, Record<CombatTraitId, number>> = {
  Fe: { ...zc(), attackPower: 0.4, defense: 0.2, stamina: 0.2, battleScars: 0.2 },
  Ca: { ...zc(), defense: 0.5, stamina: 0.2, attackPower: 0.1, battleScars: 0.2 },
  S:  { ...zc(), specialAttack: 0.4, attackPower: 0.3, speed: 0.1, battleScars: 0.2 },
  K:  { ...zc(), specialAttack: 0.3, speed: 0.3, stamina: 0.2, battleScars: 0.2 },
  Na: { ...zc(), speed: 0.4, specialAttack: 0.2, stamina: 0.2, battleScars: 0.2 },
  P:  { ...zc(), specialAttack: 0.5, speed: 0.2, stamina: 0.1, battleScars: 0.2 },
  N:  { ...zc(), stamina: 0.4, defense: 0.2, speed: 0.2, battleScars: 0.2 },
  O:  { ...zc(), stamina: 0.3, speed: 0.3, defense: 0.2, battleScars: 0.2 },
  C:  { ...zc(), defense: 0.3, attackPower: 0.3, stamina: 0.2, battleScars: 0.2 },
  Cl: { ...zc(), specialAttack: 0.3, attackPower: 0.2, speed: 0.2, battleScars: 0.3 },
};

export const ELEMENT_TRAIT_WEIGHTS: Record<ElementId, Record<TraitId, number>> = {
  N:  { ...z(), bodySize: 0.3, headSize: 0.1, limbGrowth: 0.2, skinTex: 0.1, posture: 0.3, toxicity: 0.1 },
  K:  { ...z(), limbGrowth: 0.1, eyeDev: 0.3, posture: 0.6, intelligence: 0.3, luminosity: 0.2 },
  Na: { ...z(), bodySize: 0.1, eyeDev: 0.2, skinTex: 0.3, spininess: 0.1, posture: 0.3, intelligence: 0.3, luminosity: 0.2 },
  C:  { ...z(), bodySize: 0.4, headSize: 0.2, limbGrowth: 0.3, spininess: 0.1, armoring: 0.2 },
  O:  { ...z(), bodySize: 0.2, headSize: 0.1, limbGrowth: 0.2, eyeDev: 0.1, skinTex: 0.2, posture: 0.2, luminosity: 0.2, intelligence: 0.2 },
  P:  { ...z(), headSize: 0.3, eyeDev: 0.3, furDensity: 0.1, tailGrowth: 0.1, posture: 0.1, luminosity: 0.4, toxicity: 0.2, intelligence: 0.2 },
  S:  { ...z(), skinTex: 0.3, furDensity: 0.2, spininess: 0.3, tailGrowth: 0.1, clawDev: 0.1, toxicity: 0.4, aggression: 0.3, armoring: 0.1 },
  Ca: { ...z(), headSize: 0.2, limbGrowth: 0.3, spininess: 0.2, clawDev: 0.2, bodySize: 0.1, armoring: 0.4, aggression: 0.1 },
  Fe: { ...z(), bodySize: 0.2, limbGrowth: 0.1, eyeDev: 0.1, skinTex: 0.2, clawDev: 0.3, posture: 0.1, aggression: 0.4, armoring: 0.3 },
  Cl: { ...z(), skinTex: 0.4, furDensity: 0.1, tailGrowth: 0.2, posture: 0.3, toxicity: 0.3, aggression: 0.2 },
};

// ---------------------------------------------------------------------------
// Synergies
// ---------------------------------------------------------------------------

export interface Synergy {
  id: string;
  name: string;
  elements: ElementId[];
  thresholds: Record<string, number>;
  effects: Partial<Record<TraitId, number>>;
  visualEffect?: string;
}

export const SYNERGIES: Synergy[] = [
  {
    id: 'ossatura',
    name: 'Ossatura',
    elements: ['Ca', 'P'],
    thresholds: { Ca: 15, P: 15 },
    effects: { limbGrowth: 0.3, posture: 0.2, headSize: 0.1, armoring: 0.2 },
    visualEffect: 'skeletal',
  },
  {
    id: 'sangue',
    name: 'Sangue',
    elements: ['Fe', 'O'],
    thresholds: { Fe: 12, O: 12 },
    effects: { bodySize: 0.2, eyeDev: 0.3, aggression: 0.3 },
    visualEffect: 'blood_red',
  },
  {
    id: 'veleno',
    name: 'Veleno',
    elements: ['S', 'Cl'],
    thresholds: { S: 10, Cl: 10 },
    effects: { spininess: 0.4, skinTex: 0.2, toxicity: 0.4 },
    visualEffect: 'toxic_green',
  },
  {
    id: 'neural',
    name: 'Neural',
    elements: ['K', 'Na'],
    thresholds: { K: 12, Na: 12 },
    effects: { headSize: 0.3, eyeDev: 0.4, posture: 0.2, intelligence: 0.4, luminosity: 0.2 },
    visualEffect: 'neural_glow',
  },
  {
    id: 'organico',
    name: 'Organico',
    elements: ['C', 'N', 'O'],
    thresholds: { C: 8, N: 8, O: 8 },
    effects: {
      bodySize: 0.1, headSize: 0.1, limbGrowth: 0.1, eyeDev: 0.1, skinTex: 0.1,
      furDensity: 0.1, spininess: 0.1, tailGrowth: 0.1, clawDev: 0.1, posture: 0.1,
    },
    visualEffect: 'organic_harmony',
  },
  {
    id: 'caotico',
    name: 'Caotico',
    elements: [], // special: evaluated dynamically
    thresholds: {},
    effects: {}, // filled at runtime – random trait +0.5
    visualEffect: 'chaos_shimmer',
  },
];

// ---------------------------------------------------------------------------
// Game configuration defaults
// ---------------------------------------------------------------------------

export const GAME_CONFIG = {
  DAILY_CREDITS: 50,
  STREAK_BONUS_CREDITS: 2,
  MAX_TRAIT_VALUE: 100,
  MIN_TRAIT_VALUE: 0,
  GROWTH_RATE_BASE: 0.15,
  DECAY_RATE: 0.005,
  NOISE_AMPLITUDE: 0.05,
  STABILITY_THRESHOLD_LOW: 0.3,
  STABILITY_THRESHOLD_HIGH: 0.7,
  /** Day when combat traits start appearing */
  WARRIOR_PHASE_START: 40,
  /** Day when almost all growth goes to combat */
  WARRIOR_PHASE_FULL: 80,
  /** Trait value above which physical growth slows dramatically */
  GROWTH_CAP_THRESHOLD: 80,
} as const;

// ---------------------------------------------------------------------------
// Mutation phases for multi-phase visual effects during gradual mutation
// ---------------------------------------------------------------------------

export const MUTATION_PHASES = [
  { name: 'destabilize', start: 0.0, end: 0.15, description: 'Initial destabilization — shimmer and distortion' },
  { name: 'reshape', start: 0.15, end: 0.55, description: 'Core reshaping — body proportions shift' },
  { name: 'detail', start: 0.55, end: 0.85, description: 'Detail emergence — textures, spines, claws form' },
  { name: 'stabilize', start: 0.85, end: 1.0, description: 'Stabilization — creature settles into new form' },
] as const;

export type MutationPhase = (typeof MUTATION_PHASES)[number]['name'];
