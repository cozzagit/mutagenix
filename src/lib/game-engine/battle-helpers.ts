// ---------------------------------------------------------------------------
// Mutagenix – Battle Helpers
// ---------------------------------------------------------------------------
// Converts database creature rows into BattleCreature objects for the
// battle engine. No side effects, no database calls.
// ---------------------------------------------------------------------------

import {
  ELEMENTS,
  ELEMENT_TRAIT_WEIGHTS,
  SYNERGIES,
  type ElementId,
} from './constants';

import type { Creature } from '@/lib/db/schema/creatures';
import type { CreatureRanking } from '@/lib/db/schema/creature-rankings';
import type { BattleCreature } from '@/types/battle';
import type { ElementLevels, TraitValues } from '@/types/game';

/**
 * Calculate personality distribution from element levels.
 * Same algorithm as visual-mapper: sum (elementLevel x weight), square to
 * amplify differences, then normalize so all 5 sum to 1.
 */
function calculatePersonality(elementLevels: ElementLevels): {
  aggressionLevel: number;
  luminosityLevel: number;
  toxicityLevel: number;
  intelligenceLevel: number;
  armoringLevel: number;
} {
  const pWeights = {
    aggression: 0,
    luminosity: 0,
    toxicity: 0,
    intelligence: 0,
    armoring: 0,
  };

  for (const el of ELEMENTS) {
    const elLevel = elementLevels[el] ?? 0;
    const w = ELEMENT_TRAIT_WEIGHTS[el];
    pWeights.aggression += elLevel * (w.aggression ?? 0);
    pWeights.luminosity += elLevel * (w.luminosity ?? 0);
    pWeights.toxicity += elLevel * (w.toxicity ?? 0);
    pWeights.intelligence += elLevel * (w.intelligence ?? 0);
    pWeights.armoring += elLevel * (w.armoring ?? 0);
  }

  // Square to amplify differences
  const rawAggr = pWeights.aggression * pWeights.aggression;
  const rawLumi = pWeights.luminosity * pWeights.luminosity;
  const rawToxi = pWeights.toxicity * pWeights.toxicity;
  const rawInte = pWeights.intelligence * pWeights.intelligence;
  const rawArmo = pWeights.armoring * pWeights.armoring;
  const total = rawAggr + rawLumi + rawToxi + rawInte + rawArmo;
  const norm = total > 0 ? 1 / total : 0;

  return {
    aggressionLevel: rawAggr * norm,
    luminosityLevel: rawLumi * norm,
    toxicityLevel: rawToxi * norm,
    intelligenceLevel: rawInte * norm,
    armoringLevel: rawArmo * norm,
  };
}

/**
 * Determine which synergies are active based on element levels.
 * Same logic used in synergy-system.ts: check if all required elements
 * meet their threshold values.
 */
function getActiveSynergies(elementLevels: ElementLevels): string[] {
  const active: string[] = [];

  for (const synergy of SYNERGIES) {
    if (synergy.id === 'caotico') {
      // Caotico is active when no other synergy is active AND at least
      // 4 elements have levels > 5 (chaotic distribution)
      const elemsAboveThreshold = ELEMENTS.filter(
        (el) => (elementLevels[el] ?? 0) > 5,
      ).length;
      // We check caotico after all others — only if none matched
      if (active.length === 0 && elemsAboveThreshold >= 4) {
        active.push('caotico');
      }
      continue;
    }

    const meetsThresholds = synergy.elements.every((el) => {
      const threshold = synergy.thresholds[el] ?? 0;
      return (elementLevels[el as ElementId] ?? 0) >= threshold;
    });

    if (meetsThresholds) {
      active.push(synergy.id);
    }
  }

  return active;
}

/**
 * Convert a database creature row + optional ranking into a BattleCreature
 * suitable for the battle engine.
 */
export function creatureToBattleCreature(
  creature: Creature,
  _ranking?: CreatureRanking,
): BattleCreature {
  const elementLevels = creature.elementLevels as ElementLevels;
  const traitValues = creature.traitValues as TraitValues;

  const personality = calculatePersonality(elementLevels);
  const activeSynergies = getActiveSynergies(elementLevels);

  return {
    id: creature.id,
    name: creature.name,

    // Body traits
    bodySize: traitValues.bodySize ?? 0,
    headSize: traitValues.headSize ?? 0,
    limbGrowth: traitValues.limbGrowth ?? 0,

    // Combat traits
    attackPower: traitValues.attackPower ?? 0,
    defense: traitValues.defense ?? 0,
    speed: traitValues.speed ?? 0,
    stamina: traitValues.stamina ?? 0,
    specialAttack: traitValues.specialAttack ?? 0,
    battleScars: traitValues.battleScars ?? 0,

    // Personality
    aggressionLevel: personality.aggressionLevel,
    luminosityLevel: personality.luminosityLevel,
    toxicityLevel: personality.toxicityLevel,
    intelligenceLevel: personality.intelligenceLevel,
    armoringLevel: personality.armoringLevel,

    // Synergies
    activeSynergies,

    // Element levels (as plain record for battle engine)
    elementLevels: { ...elementLevels },
  };
}
