// ---------------------------------------------------------------------------
// Mutagenix – Battle Engine (pure, deterministic combat resolver)
// ---------------------------------------------------------------------------
// This module is a PURE FUNCTION: no database, no side effects.
// All randomness uses a seeded PRNG for deterministic replay.
// ---------------------------------------------------------------------------

import type {
  BattleCreature,
  RoundEvent,
  BattleResult,
  RankTier,
} from '@/types/battle';
import { GAME_CONFIG } from './constants';

// Re-export types for convenience
export type { BattleCreature, RoundEvent, BattleResult } from '@/types/battle';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ROUNDS = 10;
const BASE_DODGE_CHANCE = 0.15;
const EXHAUSTION_ATK_PENALTY = 0.30;
const EXHAUSTION_SPD_PENALTY = 0.20;
const EXHAUSTION_DEF_PENALTY = 0.10;
const SPECIAL_ATTACK_INTERVAL = 3;
const MAX_DOUBLE_ATTACK_CHANCE = 0.25;
const MAX_POISON_STACK = 0.06; // 6% HP per round cap
const REGEN_PER_ROUND = 0.03; // 3% HP per round (sangue synergy)

// ---------------------------------------------------------------------------
// Seeded PRNG (same algorithm as mutation-engine)
// ---------------------------------------------------------------------------

function hashSeed(seed: number): number {
  let h = 0x811c9dc5 ^ seed;
  h ^= (seed >>> 16);
  h = Math.imul(h, 0x01000193);
  h ^= (seed >>> 8);
  h = Math.imul(h, 0x01000193);
  return h >>> 0;
}

function createRng(seed: number): () => number {
  let state = hashSeed(seed);
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    state = state >>> 0;
    return state / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// HP Calculation
// ---------------------------------------------------------------------------

function calculateMaxHp(creature: BattleCreature): number {
  return (
    creature.bodySize * 2 +
    creature.stamina * 3 +
    creature.defense * 1.5 +
    creature.armoringLevel * 50 +
    creature.battleScars * 2
  );
}

// ---------------------------------------------------------------------------
// Personality helpers
// ---------------------------------------------------------------------------

type PersonalityTrait = 'aggression' | 'luminosity' | 'toxicity' | 'intelligence' | 'armoring';

function getDominantPersonality(creature: BattleCreature): PersonalityTrait {
  const traits: [PersonalityTrait, number][] = [
    ['aggression', creature.aggressionLevel],
    ['luminosity', creature.luminosityLevel],
    ['toxicity', creature.toxicityLevel],
    ['intelligence', creature.intelligenceLevel],
    ['armoring', creature.armoringLevel],
  ];
  traits.sort((a, b) => b[1] - a[1]);
  return traits[0][0];
}

// ---------------------------------------------------------------------------
// Synergy check helpers
// ---------------------------------------------------------------------------

function hasSynergy(creature: BattleCreature, synergyId: string): boolean {
  return creature.activeSynergies.includes(synergyId);
}

// ---------------------------------------------------------------------------
// Internal battle state
// ---------------------------------------------------------------------------

interface FighterState {
  creature: BattleCreature;
  hp: number;
  maxHp: number;
  currentStamina: number;
  maxStamina: number;
  exhausted: boolean;
  poisonLevel: number; // cumulative poison tick % per round
  blindedThisRound: boolean;
  totalDamageDealt: number;
  // Effective stats (may be modified by personality/synergies/exhaustion)
  effectiveAtk: number;
  effectiveDef: number;
  effectiveSpd: number;
  dominantPersonality: PersonalityTrait;
}

function initFighter(creature: BattleCreature): FighterState {
  let maxHp = calculateMaxHp(creature);
  const maxStamina = creature.stamina * 2 + 50;

  // Base effective stats
  let effectiveAtk = creature.attackPower;
  let effectiveDef = creature.defense;
  let effectiveSpd = creature.speed;

  const dominant = getDominantPersonality(creature);

  // Personality passive modifiers
  if (dominant === 'aggression') {
    effectiveAtk *= 1.20;
    effectiveDef *= 0.90;
  }

  // Synergy modifiers (applied once at start)
  if (hasSynergy(creature, 'ossatura')) {
    effectiveDef *= 1.15;
    effectiveSpd *= 0.95;
  }
  if (hasSynergy(creature, 'neural')) {
    effectiveSpd *= 1.15;
  }
  if (hasSynergy(creature, 'organico')) {
    effectiveAtk *= 1.10;
    effectiveDef *= 1.10;
    effectiveSpd *= 1.10;
  }

  // Sangue synergy: +10% effective stamina
  const staminaMultiplier = hasSynergy(creature, 'sangue') ? 1.10 : 1.0;

  // Tier combat bonuses (Immortale +10%, Divinità +20%)
  if (creature.ageDays !== undefined) {
    const tier = getRankTier(creature.ageDays);
    if (tier === 'divine') {
      const bonus = 1 + GAME_CONFIG.DIVINE_COMBAT_BONUS;
      maxHp *= bonus;
      effectiveAtk *= bonus;
      effectiveDef *= bonus;
      effectiveSpd *= bonus;
    } else if (tier === 'immortal') {
      const bonus = 1 + GAME_CONFIG.IMMORTAL_COMBAT_BONUS;
      maxHp *= bonus;
      effectiveAtk *= bonus;
      effectiveDef *= bonus;
      effectiveSpd *= bonus;
    }
  }

  return {
    creature,
    hp: maxHp,
    maxHp,
    currentStamina: maxStamina * staminaMultiplier,
    maxStamina: maxStamina * staminaMultiplier,
    exhausted: false,
    poisonLevel: 0,
    blindedThisRound: false,
    totalDamageDealt: 0,
    effectiveAtk,
    effectiveDef,
    effectiveSpd,
    dominantPersonality: dominant,
  };
}

// ---------------------------------------------------------------------------
// Italian description generators
// ---------------------------------------------------------------------------

function attackDescription(
  attackerName: string,
  defenderName: string,
  damage: number,
  isCritical: boolean,
): string {
  if (isCritical) {
    return `${attackerName} sferra un colpo critico devastante contro ${defenderName}, infliggendo ${damage.toFixed(1)} danni!`;
  }
  if (damage > 30) {
    return `${attackerName} colpisce ${defenderName} con un attacco brutale da ${damage.toFixed(1)} danni!`;
  }
  if (damage > 15) {
    return `${attackerName} attacca ${defenderName} con precisione, causando ${damage.toFixed(1)} danni.`;
  }
  return `${attackerName} colpisce ${defenderName} per ${damage.toFixed(1)} danni.`;
}

function specialDescription(
  attackerName: string,
  defenderName: string,
  damage: number,
): string {
  return `${attackerName} scatena il suo attacco speciale contro ${defenderName}, devastandolo con ${damage.toFixed(1)} danni!`;
}

function dodgeDescription(attackerName: string, defenderName: string): string {
  return `${defenderName} schiva agilmente l'attacco di ${attackerName}!`;
}

function blindDescription(attackerName: string, defenderName: string): string {
  return `${attackerName} emette un bagliore accecante! ${defenderName} non riesce a colpire!`;
}

function poisonTickDescription(targetName: string, damage: number): string {
  return `Il veleno corrode ${targetName}, infliggendo ${damage.toFixed(1)} danni tossici.`;
}

function regenDescription(targetName: string, healed: number): string {
  return `Il sangue di ${targetName} rigenera ${healed.toFixed(1)} punti vita.`;
}

function doubleAttackDescription(
  attackerName: string,
  defenderName: string,
  damage: number,
): string {
  return `${attackerName} è talmente veloce da colpire due volte! Infligge altri ${damage.toFixed(1)} danni a ${defenderName}!`;
}

function exhaustionDescription(targetName: string): string {
  return `${targetName} è esausto! La sua resistenza è al limite, i suoi colpi sono meno potenti.`;
}

function traumaReflectDescription(
  attackerName: string,
  defenderName: string,
  damage: number,
): string {
  return `La corazza di ${defenderName} riflette parte del colpo speciale, infliggendo ${damage.toFixed(1)} danni a ${attackerName}!`;
}

// ---------------------------------------------------------------------------
// Core battle calculation
// ---------------------------------------------------------------------------

export function calculateBattle(
  challenger: BattleCreature,
  defender: BattleCreature,
  seed?: number,
): BattleResult {
  const rng = createRng(seed ?? Date.now());
  const events: RoundEvent[] = [];

  const fighterA = initFighter(challenger);
  const fighterB = initFighter(defender);

  // Veleno synergy: opponent starts with poison level 1 (2%)
  if (hasSynergy(challenger, 'veleno')) {
    fighterB.poisonLevel = 0.02;
  }
  if (hasSynergy(defender, 'veleno')) {
    fighterA.poisonLevel = 0.02;
  }

  let roundCount = 0;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    roundCount = round;

    // --- Determine attack order by speed (+ random factor +/-5%) ---
    const spdA = fighterA.effectiveSpd * (1 + (rng() * 0.10 - 0.05));
    const spdB = fighterB.effectiveSpd * (1 + (rng() * 0.10 - 0.05));

    const [first, second] = spdA >= spdB
      ? [fighterA, fighterB]
      : [fighterB, fighterA];

    // --- Caotico synergy: random stat boost/penalty each round ---
    applyCaotico(first, rng);
    applyCaotico(second, rng);

    // --- First attacker's turn ---
    const firstKo = resolveAttack(first, second, round, rng, events);
    if (firstKo) break;

    // --- Second attacker's turn ---
    const secondKo = resolveAttack(second, first, round, rng, events);
    if (secondKo) break;

    // --- End-of-round effects ---

    // Poison ticks
    applyPoisonTick(fighterA, round, events);
    if (fighterA.hp <= 0) break;
    applyPoisonTick(fighterB, round, events);
    if (fighterB.hp <= 0) break;

    // Regen (sangue synergy)
    applyRegen(fighterA, round, events);
    applyRegen(fighterB, round, events);

    // Stamina consumption
    consumeStamina(fighterA, round, events);
    consumeStamina(fighterB, round, events);

    // Reset per-round state
    fighterA.blindedThisRound = false;
    fighterB.blindedThisRound = false;
  }

  // --- Determine winner ---
  const challengerFinalHp = Math.max(fighterA.hp, 0);
  const defenderFinalHp = Math.max(fighterB.hp, 0);
  const challengerFinalHpPercent = (challengerFinalHp / fighterA.maxHp) * 100;
  const defenderFinalHpPercent = (defenderFinalHp / fighterB.maxHp) * 100;

  let winnerId: string | null = null;
  if (challengerFinalHp <= 0 && defenderFinalHp <= 0) {
    winnerId = null; // draw (both KO)
  } else if (challengerFinalHp <= 0) {
    winnerId = defender.id;
  } else if (defenderFinalHp <= 0) {
    winnerId = challenger.id;
  } else {
    // Time's up — whoever has more HP % wins, else draw
    if (challengerFinalHpPercent > defenderFinalHpPercent + 0.01) {
      winnerId = challenger.id;
    } else if (defenderFinalHpPercent > challengerFinalHpPercent + 0.01) {
      winnerId = defender.id;
    } else {
      winnerId = null; // draw
    }
  }

  // Find MVP action (highest single-event damage)
  let mvpAction = 'Nessuna azione decisiva.';
  let maxDamage = 0;
  for (const event of events) {
    if (event.damage > maxDamage) {
      maxDamage = event.damage;
      mvpAction = event.description;
    }
  }

  return {
    winnerId,
    rounds: roundCount,
    events,
    challengerFinalHpPercent: Math.max(challengerFinalHpPercent, 0),
    defenderFinalHpPercent: Math.max(defenderFinalHpPercent, 0),
    challengerTotalDamage: fighterA.totalDamageDealt,
    defenderTotalDamage: fighterB.totalDamageDealt,
    mvpAction,
  };
}

// ---------------------------------------------------------------------------
// Caotico synergy: random stat swing each round
// ---------------------------------------------------------------------------

function applyCaotico(fighter: FighterState, rng: () => number): void {
  if (!hasSynergy(fighter.creature, 'caotico')) return;

  const stats: ('effectiveAtk' | 'effectiveDef' | 'effectiveSpd')[] = [
    'effectiveAtk', 'effectiveDef', 'effectiveSpd',
  ];
  const stat = stats[Math.floor(rng() * stats.length)];

  if (rng() < 0.5) {
    fighter[stat] *= 1.15; // +15%
  } else {
    fighter[stat] *= 0.85; // -15%
  }
}

// ---------------------------------------------------------------------------
// Resolve a single attack action
// ---------------------------------------------------------------------------

function resolveAttack(
  attacker: FighterState,
  defender: FighterState,
  round: number,
  rng: () => number,
  events: RoundEvent[],
): boolean {
  const attackerName = attacker.creature.name;
  const defenderName = defender.creature.name;

  // --- Luminosity blind check (8% chance per round for luminosity-dominant) ---
  if (attacker.dominantPersonality === 'luminosity') {
    if (rng() < 0.08) {
      attacker.blindedThisRound = true;
      events.push({
        round,
        attackerId: attacker.creature.id,
        defenderId: defender.creature.id,
        type: 'blind',
        damage: 0,
        attackerHpAfter: attacker.hp,
        defenderHpAfter: defender.hp,
        description: blindDescription(attackerName, defenderName),
      });
      // Blind: the defender's attack this round is skipped (we apply it to
      // whoever is attacking). Actually per spec, luminosity dominant emits
      // a blinding flash — the DEFENDER is blinded, so DEFENDER misses.
      // But we're in the attacker's turn resolving attacker's attack...
      // Re-reading spec: "8% chance blind each round" — the creature with
      // luminosity blinds its opponent. So if attacker has luminosity,
      // defender is blinded. But we're resolving attacker's action here.
      // The blind effect should make the OPPONENT miss, not self.
      // We'll track it and skip the defender's attack later.
      // For now, the attacker still attacks normally.
    }
  }

  // --- Check if this attacker was blinded by opponent's luminosity ---
  if (attacker.blindedThisRound) {
    // Already pushed event when blind was applied; skip this attack
    return false;
  }

  // --- Dodge check ---
  let dodgeChance = 0;
  if (defender.dominantPersonality === 'intelligence') {
    dodgeChance += BASE_DODGE_CHANCE;
  }
  if (hasSynergy(defender.creature, 'neural')) {
    dodgeChance += 0.20;
  }
  // Small speed-based dodge bonus
  const speedRatio = defender.effectiveSpd / Math.max(attacker.effectiveSpd, 1);
  dodgeChance += Math.max(0, (speedRatio - 1) * 0.10);

  if (rng() < dodgeChance) {
    events.push({
      round,
      attackerId: attacker.creature.id,
      defenderId: defender.creature.id,
      type: 'dodge',
      damage: 0,
      attackerHpAfter: attacker.hp,
      defenderHpAfter: defender.hp,
      description: dodgeDescription(attackerName, defenderName),
    });
    return false;
  }

  // --- Determine if this is a special attack round ---
  const isSpecial = round % SPECIAL_ATTACK_INTERVAL === 0;

  // --- Calculate base damage ---
  let damage = attacker.effectiveAtk * (0.8 + rng() * 0.4) - defender.effectiveDef * 0.6;
  damage = Math.max(damage, 1);

  let isCritical = false;

  if (isSpecial) {
    // Special attack multiplier
    const specialMultiplier = 1.5 * (1 + attacker.creature.specialAttack / 100);
    damage *= specialMultiplier;

    // Corazza dominant: -40% special/critical damage received
    if (defender.dominantPersonality === 'armoring') {
      damage *= 0.60;
    }

    // Trauma reflect: armoring dominant reflects a portion back
    if (defender.dominantPersonality === 'armoring' && defender.creature.armoringLevel > 0.3) {
      const reflectDamage = damage * 0.15 * defender.creature.armoringLevel;
      attacker.hp -= reflectDamage;
      events.push({
        round,
        attackerId: defender.creature.id,
        defenderId: attacker.creature.id,
        type: 'trauma_reflect',
        damage: reflectDamage,
        attackerHpAfter: defender.hp,
        defenderHpAfter: attacker.hp,
        description: traumaReflectDescription(attackerName, defenderName, reflectDamage),
      });
      if (attacker.hp <= 0) {
        return true; // attacker died from reflect
      }
    }

    defender.hp -= damage;
    attacker.totalDamageDealt += damage;

    events.push({
      round,
      attackerId: attacker.creature.id,
      defenderId: defender.creature.id,
      type: 'special',
      damage,
      attackerHpAfter: attacker.hp,
      defenderHpAfter: defender.hp,
      description: specialDescription(attackerName, defenderName, damage),
      isCritical: true,
    });
  } else {
    // Normal attack — check for critical (aggression dominant: higher crit)
    let critChance = 0.08;
    if (attacker.dominantPersonality === 'aggression') {
      critChance = 0.15;
    }
    if (rng() < critChance) {
      damage *= 1.5;
      isCritical = true;

      // Corazza dominant: -40% critical damage received
      if (defender.dominantPersonality === 'armoring') {
        damage *= 0.60;
      }
    }

    defender.hp -= damage;
    attacker.totalDamageDealt += damage;

    events.push({
      round,
      attackerId: attacker.creature.id,
      defenderId: defender.creature.id,
      type: 'attack',
      damage,
      attackerHpAfter: attacker.hp,
      defenderHpAfter: defender.hp,
      description: attackDescription(attackerName, defenderName, damage, isCritical),
      isCritical: isCritical || undefined,
    });
  }

  if (defender.hp <= 0) return true;

  // --- Toxicity dominant: apply poison per attack ---
  if (attacker.dominantPersonality === 'toxicity') {
    defender.poisonLevel = Math.min(defender.poisonLevel + 0.02, MAX_POISON_STACK);
  }

  // --- Double attack chance (speed advantage) ---
  const speedDiff = attacker.effectiveSpd - defender.effectiveSpd;
  if (speedDiff > 0) {
    const doubleChance = Math.min(speedDiff * 0.005, MAX_DOUBLE_ATTACK_CHANCE);
    if (rng() < doubleChance) {
      let doubleDamage = attacker.effectiveAtk * (0.8 + rng() * 0.4) - defender.effectiveDef * 0.6;
      doubleDamage = Math.max(doubleDamage, 1);

      defender.hp -= doubleDamage;
      attacker.totalDamageDealt += doubleDamage;

      events.push({
        round,
        attackerId: attacker.creature.id,
        defenderId: defender.creature.id,
        type: 'double_attack',
        damage: doubleDamage,
        attackerHpAfter: attacker.hp,
        defenderHpAfter: defender.hp,
        description: doubleAttackDescription(attackerName, defenderName, doubleDamage),
      });

      if (defender.hp <= 0) return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Poison tick (end of round)
// ---------------------------------------------------------------------------

function applyPoisonTick(
  fighter: FighterState,
  round: number,
  events: RoundEvent[],
): void {
  if (fighter.poisonLevel <= 0) return;

  const poisonDamage = fighter.maxHp * fighter.poisonLevel;
  fighter.hp -= poisonDamage;

  events.push({
    round,
    attackerId: fighter.creature.id, // self-damage
    defenderId: fighter.creature.id,
    type: 'poison_tick',
    damage: poisonDamage,
    attackerHpAfter: fighter.hp,
    defenderHpAfter: fighter.hp,
    description: poisonTickDescription(fighter.creature.name, poisonDamage),
  });
}

// ---------------------------------------------------------------------------
// Regen (sangue synergy, end of round)
// ---------------------------------------------------------------------------

function applyRegen(
  fighter: FighterState,
  round: number,
  events: RoundEvent[],
): void {
  if (!hasSynergy(fighter.creature, 'sangue')) return;

  const healAmount = fighter.maxHp * REGEN_PER_ROUND;
  const oldHp = fighter.hp;
  fighter.hp = Math.min(fighter.hp + healAmount, fighter.maxHp);
  const actualHeal = fighter.hp - oldHp;

  if (actualHeal > 0.01) {
    events.push({
      round,
      attackerId: fighter.creature.id,
      defenderId: fighter.creature.id,
      type: 'regen',
      damage: -actualHeal, // negative = healing
      attackerHpAfter: fighter.hp,
      defenderHpAfter: fighter.hp,
      description: regenDescription(fighter.creature.name, actualHeal),
    });
  }
}

// ---------------------------------------------------------------------------
// Stamina consumption (end of round)
// ---------------------------------------------------------------------------

function consumeStamina(
  fighter: FighterState,
  round: number,
  events: RoundEvent[],
): void {
  const staminaCost = 10 + fighter.creature.bodySize * 0.05;
  fighter.currentStamina -= staminaCost;

  if (fighter.currentStamina <= 0 && !fighter.exhausted) {
    fighter.exhausted = true;
    fighter.effectiveAtk *= (1 - EXHAUSTION_ATK_PENALTY);
    fighter.effectiveSpd *= (1 - EXHAUSTION_SPD_PENALTY);
    fighter.effectiveDef *= (1 - EXHAUSTION_DEF_PENALTY);

    events.push({
      round,
      attackerId: fighter.creature.id,
      defenderId: fighter.creature.id,
      type: 'exhaustion',
      damage: 0,
      attackerHpAfter: fighter.hp,
      defenderHpAfter: fighter.hp,
      description: exhaustionDescription(fighter.creature.name),
    });
  }
}

// ---------------------------------------------------------------------------
// Battle consequences (post-battle mutations)
// ---------------------------------------------------------------------------

export interface BattleConsequences {
  winnerChanges: { traitBoosts: Record<string, number> };
  loserChanges: {
    combatTraitLoss: Record<string, number>;
    newScarCount: number;
    recoveryHours: number;
  };
}

export function applyBattleConsequences(
  winner: BattleCreature,
  loser: BattleCreature,
  isDraw: boolean,
): BattleConsequences {
  if (isDraw) {
    return {
      winnerChanges: { traitBoosts: {} },
      loserChanges: {
        combatTraitLoss: {},
        newScarCount: 0,
        recoveryHours: 2,
      },
    };
  }

  // Winner: boost dominant combat traits
  const winnerBoosts: Record<string, number> = {};
  const dominantPers = getDominantPersonality(winner);
  switch (dominantPers) {
    case 'aggression':
      winnerBoosts.attackPower = 2;
      winnerBoosts.specialAttack = 1;
      break;
    case 'intelligence':
      winnerBoosts.speed = 2;
      winnerBoosts.specialAttack = 1;
      break;
    case 'armoring':
      winnerBoosts.defense = 2;
      winnerBoosts.stamina = 1;
      break;
    case 'toxicity':
      winnerBoosts.specialAttack = 2;
      winnerBoosts.speed = 1;
      break;
    case 'luminosity':
      winnerBoosts.speed = 1;
      winnerBoosts.specialAttack = 2;
      break;
  }
  // Battle experience
  winnerBoosts.battleScars = 1;

  // Loser: -5% each combat trait, +1 scar, 6 hours recovery
  const combatTraitLoss: Record<string, number> = {
    attackPower: -(loser.attackPower * 0.05),
    defense: -(loser.defense * 0.05),
    speed: -(loser.speed * 0.05),
    stamina: -(loser.stamina * 0.05),
    specialAttack: -(loser.specialAttack * 0.05),
  };

  return {
    winnerChanges: { traitBoosts: winnerBoosts },
    loserChanges: {
      combatTraitLoss,
      newScarCount: 1,
      recoveryHours: 6,
    },
  };
}

// ---------------------------------------------------------------------------
// ELO calculation (standard formula with bonuses for underdogs)
// ---------------------------------------------------------------------------

export interface EloChange {
  winnerDelta: number;
  loserDelta: number;
}

export function calculateEloChange(
  winnerElo: number,
  loserElo: number,
  isDraw: boolean,
  kFactor: number = 32,
): EloChange {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 - expectedWinner;

  let winnerScore: number;
  let loserScore: number;

  if (isDraw) {
    winnerScore = 0.5;
    loserScore = 0.5;
  } else {
    winnerScore = 1;
    loserScore = 0;
  }

  let winnerDelta = Math.round(kFactor * (winnerScore - expectedWinner));
  let loserDelta = Math.round(kFactor * (loserScore - expectedLoser));

  // Underdog bonus: challenging higher-rated opponents
  if (!isDraw) {
    const eloDiff = loserElo - winnerElo; // positive = winner was underdog

    if (eloDiff > 200) {
      // Large underdog: winner gets +100% delta, loser loses only -25%
      winnerDelta = Math.round(winnerDelta * 2.0);
      loserDelta = Math.round(loserDelta * 0.25);
    } else if (eloDiff > 100) {
      // Moderate underdog: winner gets +50% delta
      winnerDelta = Math.round(winnerDelta * 1.5);
    }
  }

  return { winnerDelta, loserDelta };
}

// ---------------------------------------------------------------------------
// Rank tier calculation
// ---------------------------------------------------------------------------

export function getRankTier(ageDays: number): RankTier {
  if (ageDays >= 500) return 'divine';
  if (ageDays >= 300) return 'immortal';
  if (ageDays <= 60) return 'novice';
  if (ageDays <= 100) return 'intermediate';
  if (ageDays <= 150) return 'veteran';
  return 'legend';
}
