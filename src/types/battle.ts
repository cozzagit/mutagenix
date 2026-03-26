// ---------------------------------------------------------------------------
// Mutagenix – Battle Types
// ---------------------------------------------------------------------------

/** A creature prepared for battle with all relevant stats extracted. */
export interface BattleCreature {
  id: string;
  name: string;
  // Body traits (0-100)
  bodySize: number;
  headSize: number;
  limbGrowth: number;
  // Combat traits (0-100)
  attackPower: number;
  defense: number;
  speed: number;
  stamina: number;
  specialAttack: number;
  battleScars: number;
  // Personality (0-1, normalized distribution)
  aggressionLevel: number;
  luminosityLevel: number;
  toxicityLevel: number;
  intelligenceLevel: number;
  armoringLevel: number;
  // Active synergies
  activeSynergies: string[];
  // Element levels (for synergy checks)
  elementLevels: Record<string, number>;
  // Age in days (used for tier combat bonuses)
  ageDays?: number;
  // Arena Experience Points (AXP)
  axp: number;
  // Stability (0-1, higher = more stable)
  stability: number;
  // Wellness indicators (0-100 each, optional — defaults to 100 if missing)
  wellness?: {
    activity: number;
    hunger: number;
    boredom: number;
    fatigue: number;
    composite: number;
  };
  // Cariche held by this creature (optional)
  caricheIds?: string[];
}

/** A single event that occurred during a battle round. */
export interface RoundEvent {
  round: number;
  attackerId: string;
  defenderId: string;
  type:
    | 'attack'
    | 'special'
    | 'double_attack'
    | 'dodge'
    | 'poison_tick'
    | 'regen'
    | 'blind'
    | 'trauma_reflect'
    | 'exhaustion'
    | 'stability_glitch'
    | 'self_damage'
    | 'backfire'
    | 'stability_regen'
    | 'stability_glitch_minor';
  damage: number;
  attackerHpAfter: number;
  defenderHpAfter: number;
  description: string; // Italian description for replay
  isCritical?: boolean;
}

/** The complete result of a resolved battle. */
export interface BattleResult {
  winnerId: string | null; // null = draw
  rounds: number;
  events: RoundEvent[];
  challengerFinalHpPercent: number;
  defenderFinalHpPercent: number;
  challengerTotalDamage: number;
  defenderTotalDamage: number;
  mvpAction: string; // most impactful event description
}

/** Type of battle engagement. */
export type BattleType = 'ranked' | 'direct' | 'tournament';

/** Rank tiers based on creature age. */
export type RankTier = 'novice' | 'intermediate' | 'veteran' | 'legend' | 'immortal' | 'divine' | 'eternal';
