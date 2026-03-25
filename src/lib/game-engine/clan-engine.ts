// ---------------------------------------------------------------------------
// Mutagenix – Clan Engine (Betrayal System)
// ---------------------------------------------------------------------------
// Pure function module for calculating betrayal damage when a creature
// leaves a clan. Each clan member strikes the traitor, causing permanent
// stat loss.
// ---------------------------------------------------------------------------

export interface BetrayalStrike {
  attackerName: string;
  damage: number;
  description: string; // Italian, mafia flavor
}

export interface BetrayalResult {
  totalStatLossPercent: number; // 10-20% clamped
  strikes: BetrayalStrike[];
  traitLosses: Record<string, number>; // per-trait reductions
}

const STRIKE_DESCRIPTIONS = [
  '{name} sferra un colpo brutale!',
  '{name} colpisce con precisione chirurgica!',
  '{name} scarica tutta la sua rabbia!',
  '{name} attacca senza pietà!',
  '{name} colpisce alle spalle, come meriti!',
  '{name} ti spezza le ossa con un calcio!',
  '{name} sferra un pugno devastante!',
  '{name} attacca con furia cieca!',
  '{name} ti insegna cosa significa tradire!',
  '{name} colpisce dritto al cuore!',
  '{name} non risparmia il traditore!',
  '{name} sfoga la vendetta della Famiglia!',
  '{name} colpisce con la forza della lealtà!',
  '{name} ti marchia come traditore!',
  '{name} non perdona, non dimentica!',
];

// Simple seeded PRNG (mulberry32)
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COMBAT_TRAITS = ['attackPower', 'defense', 'speed', 'stamina', 'specialAttack'] as const;

export function calculateBetrayalDamage(
  clanMembers: Array<{ name: string; attackPower: number; specialAttack: number }>,
  traitor: {
    name: string;
    attackPower: number;
    defense: number;
    stamina: number;
    speed: number;
    specialAttack: number;
  },
  seed: number,
): BetrayalResult {
  const rng = seededRandom(seed);

  // Each clan member gets ONE strike
  const strikes: BetrayalStrike[] = [];
  let totalDamage = 0;

  for (let i = 0; i < clanMembers.length; i++) {
    const member = clanMembers[i];
    const multiplier = 0.7 + rng() * 0.6; // random(0.7, 1.3)
    const damage = (member.attackPower * 0.5 + member.specialAttack * 0.3) * multiplier;

    const descTemplate = STRIKE_DESCRIPTIONS[Math.floor(rng() * STRIKE_DESCRIPTIONS.length)];
    const description = descTemplate.replace('{name}', member.name);

    strikes.push({
      attackerName: member.name,
      damage: Math.round(damage * 10) / 10,
      description,
    });

    totalDamage += damage;
  }

  // Normalize to % of traitor's effective HP
  const effectiveHp = traitor.defense * 2 + traitor.stamina * 3;
  const rawPercent = effectiveHp > 0 ? (totalDamage / effectiveHp) * 100 : 15;

  // Clamp to 10-20%
  const totalStatLossPercent = Math.min(20, Math.max(10, rawPercent));
  const lossFraction = totalStatLossPercent / 100;

  // Distribute loss across combat traits proportionally
  const traitLosses: Record<string, number> = {};
  const traitValues: Record<string, number> = {
    attackPower: traitor.attackPower,
    defense: traitor.defense,
    speed: traitor.speed,
    stamina: traitor.stamina,
    specialAttack: traitor.specialAttack,
  };

  const totalTraitValue = Object.values(traitValues).reduce((s, v) => s + v, 0);

  for (const trait of COMBAT_TRAITS) {
    const proportion = totalTraitValue > 0 ? traitValues[trait] / totalTraitValue : 0.2;
    const loss = Math.round(traitValues[trait] * lossFraction * proportion * 10) / 10;
    // Ensure minimum loss of at least lossFraction * value * 0.5 for each trait
    const minLoss = Math.round(traitValues[trait] * lossFraction * 0.5 * 10) / 10;
    traitLosses[trait] = Math.max(loss, minLoss);
  }

  return {
    totalStatLossPercent: Math.round(totalStatLossPercent * 10) / 10,
    strikes,
    traitLosses,
  };
}
