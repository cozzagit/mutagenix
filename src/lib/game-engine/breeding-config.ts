// ---------------------------------------------------------------------------
// Mutagenix – Breeding System Configuration
// ---------------------------------------------------------------------------

export const BREEDING_CONFIG = {
  /** Percentage of traits inherited from the partner's creature */
  INHERITANCE_RATIO_PARTNER: 0.65,
  /** Percentage of traits inherited from own creature */
  INHERITANCE_RATIO_OWN: 0.35,
  /** Element levels scale factor (offspring start young) */
  ELEMENT_SCALE_FACTOR: 0.45,
  /** Physical trait scale factor (traits develop with injections) */
  TRAIT_SCALE_FACTOR: 0.30,
  /** Per-trait chance of genetic anomaly */
  ANOMALY_CHANCE: 0.15,
  /** Chance of mild anomaly (trait *= random [0.8, 1.2]) */
  MILD_ANOMALY_CHANCE: 0.10,
  /** Chance of major anomaly (trait += random [-15, +15]) */
  MAJOR_ANOMALY_CHANCE: 0.05,
  /** Base energy cost per breeding */
  BASE_ENERGY_COST: 30,
  /** Energy cost multiplier per generation */
  GENERATION_COST_MULTIPLIER: 1.5,
  /** Maximum energy a player can have */
  MAX_ENERGY: 100,
  /** Energy regenerated per day */
  DAILY_ENERGY_REGEN: 10,
  /** Hours before a breeding request expires */
  REQUEST_EXPIRY_HOURS: 48,
  /** Cooldown between breedings (ms) */
  BREEDING_COOLDOWN_MS: 24 * 60 * 60 * 1000,
  /** Maximum family generation depth */
  MAX_GENERATIONS: 3,
  /** Maximum children per creature */
  MAX_CHILDREN_PER_CREATURE: 3,
  /** Maximum creatures a player can own */
  MAX_CREATURES_PER_PLAYER: 13,
  /** Credits awarded per offspring */
  CREDITS_PER_OFFSPRING: 25,
} as const;
