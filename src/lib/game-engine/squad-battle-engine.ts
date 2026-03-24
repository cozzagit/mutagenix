// ---------------------------------------------------------------------------
// Mutagenix – Squad Battle Engine (pure, no DB)
// ---------------------------------------------------------------------------
// Orchestrates multi-creature (1v1, 2v2, 3v3) battles by running individual
// duels through the existing battle-engine and aggregating results.
// ---------------------------------------------------------------------------

import { calculateBattle } from './battle-engine';
import type { BattleCreature, BattleResult } from '@/types/battle';
import {
  calculateKinship,
  type CreatureAncestry,
  type KinshipResult,
} from './kinship-engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BattleFormat = '1v1' | '2v2' | '3v3';
export type BattleMode = 'ranked' | 'farming' | 'tournament';

export interface SquadSide {
  userId: string;
  creatures: BattleCreature[];
  clanId?: string;
  ancestry: CreatureAncestry[];
}

export interface DuelSetup {
  creature1: BattleCreature;
  creature2: BattleCreature;
  kinship: KinshipResult;
  teamBonus1: number;
  teamBonus2: number;
}

export interface DuelOutcome {
  battleResult: BattleResult;
  creature1Id: string;
  creature2Id: string;
  winnerId: string | null;
  kinshipMalus: number;
  teamBonus1: number;
  teamBonus2: number;
  hpPercent1: number;
  hpPercent2: number;
}

export interface SquadBattleResult {
  winnerUserId: string | null; // null = draw
  format: BattleFormat;
  duels: DuelOutcome[];
  team1Wins: number;
  team2Wins: number;
  team1TotalHpPercent: number;
  team2TotalHpPercent: number;
}

// ---------------------------------------------------------------------------
// Seeded PRNG (same algorithm as battle-engine)
// ---------------------------------------------------------------------------

function hashSeedString(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FORMAT_TO_DUELS: Record<BattleFormat, number> = {
  '1v1': 1,
  '2v2': 2,
  '3v3': 3,
};

/**
 * Calculate team affinity bonus based on how many creatures share a clan.
 * 3/3 same clan = 0.08, 2/3 = 0.04, otherwise 0.
 * In farming mode, bonuses are doubled.
 */
function calculateTeamBonus(
  side: SquadSide,
  duelCount: number,
  mode: BattleMode,
): number {
  if (!side.clanId || duelCount <= 1) return 0;

  // Count creatures that belong to the team's clan
  // For simplicity we check how many creatures are present
  // (clan membership is indicated by side.clanId existing; all creatures
  // on a side are assumed in the same clan if clanId is set)
  const total = side.creatures.length;

  let base: number;
  if (total >= 3) {
    base = 0.08;
  } else if (total >= 2) {
    base = 0.04;
  } else {
    base = 0;
  }

  return mode === 'farming' ? base * 2 : base;
}

/**
 * Create a modified copy of a BattleCreature with kinship/team modifiers applied.
 * Never mutates the original.
 */
function applyModifiers(
  creature: BattleCreature,
  teamBonus: number,
  kinshipMalus: number,
): BattleCreature {
  const modifier = 1 + teamBonus - kinshipMalus;
  return {
    ...creature,
    attackPower: creature.attackPower * modifier,
    defense: creature.defense * modifier,
    speed: creature.speed * modifier,
    stamina: creature.stamina * modifier,
  };
}

/**
 * Find the ancestry record for a creature by ID.
 */
function findAncestry(
  creatureId: string,
  ancestryList: CreatureAncestry[],
): CreatureAncestry {
  const found = ancestryList.find((a) => a.id === creatureId);
  // Fallback: creature with no known parents
  return found ?? { id: creatureId, parentAId: null, parentBId: null };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function executeSquadBattle(
  team1: SquadSide,
  team2: SquadSide,
  format: BattleFormat,
  mode: BattleMode,
  seed: string,
): SquadBattleResult {
  const duelCount = FORMAT_TO_DUELS[format];
  const baseSeed = hashSeedString(seed);

  const teamBonus1 = calculateTeamBonus(team1, duelCount, mode);
  const teamBonus2 = calculateTeamBonus(team2, duelCount, mode);

  const allAncestry = [...team1.ancestry, ...team2.ancestry];
  const duels: DuelOutcome[] = [];
  let team1Wins = 0;
  let team2Wins = 0;
  let team1TotalHp = 0;
  let team2TotalHp = 0;

  for (let i = 0; i < duelCount; i++) {
    const c1 = team1.creatures[i];
    const c2 = team2.creatures[i];

    if (!c1 || !c2) break; // safety: not enough creatures

    // Calculate kinship between opponents
    const ancestry1 = findAncestry(c1.id, allAncestry);
    const ancestry2 = findAncestry(c2.id, allAncestry);
    const kinship = calculateKinship(ancestry1, ancestry2, allAncestry);

    // Apply modifiers (creates copies)
    const modified1 = applyModifiers(c1, teamBonus1, kinship.malusMultiplier);
    const modified2 = applyModifiers(c2, teamBonus2, kinship.malusMultiplier);

    // Run the duel through the existing battle engine
    const battleResult = calculateBattle(modified1, modified2, baseSeed + i);

    // Determine winner
    let winnerId: string | null = null;
    if (battleResult.winnerId === modified1.id) {
      winnerId = c1.id;
      team1Wins++;
    } else if (battleResult.winnerId === modified2.id) {
      winnerId = c2.id;
      team2Wins++;
    }

    team1TotalHp += battleResult.challengerFinalHpPercent;
    team2TotalHp += battleResult.defenderFinalHpPercent;

    duels.push({
      battleResult,
      creature1Id: c1.id,
      creature2Id: c2.id,
      winnerId,
      kinshipMalus: kinship.malusMultiplier,
      teamBonus1,
      teamBonus2,
      hpPercent1: battleResult.challengerFinalHpPercent,
      hpPercent2: battleResult.defenderFinalHpPercent,
    });
  }

  // Determine overall winner: best of N (majority wins)
  let winnerUserId: string | null;
  if (team1Wins > team2Wins) {
    winnerUserId = team1.userId;
  } else if (team2Wins > team1Wins) {
    winnerUserId = team2.userId;
  } else {
    // Tied on wins (possible in 2v2): compare total HP%
    if (team1TotalHp > team2TotalHp) {
      winnerUserId = team1.userId;
    } else if (team2TotalHp > team1TotalHp) {
      winnerUserId = team2.userId;
    } else {
      winnerUserId = null; // true draw
    }
  }

  return {
    winnerUserId,
    format,
    duels,
    team1Wins,
    team2Wins,
    team1TotalHpPercent: duelCount > 0 ? team1TotalHp / duelCount : 0,
    team2TotalHpPercent: duelCount > 0 ? team2TotalHp / duelCount : 0,
  };
}
