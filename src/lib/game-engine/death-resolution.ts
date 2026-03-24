// ---------------------------------------------------------------------------
// Mutagenix – Death Resolution Engine (pure, no DB)
// ---------------------------------------------------------------------------
// Determines which creatures die at the end of a tournament based on
// accumulated damage and final standings.
// ---------------------------------------------------------------------------

export interface TournamentStanding {
  participantId: string;
  userId: string;
  finalRank: number;
  totalParticipants: number;
  accumulatedDamage: Record<string, { damageTaken: number; hpPercent: number }>;
  creatures: Array<{
    id: string;
    isFounder: boolean;
    hpPercent: number;
  }>;
}

export interface DeathVerdict {
  creatureId: string;
  cause: 'tournament_damage';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEATH_THRESHOLD = 0.7;
const RANK_WEIGHT = 0.4;
const DAMAGE_WEIGHT = 0.6;
const CRITICAL_HP = 15; // hpPercent <= this → dies
const DANGER_HP = 30; // hpPercent <= this + bottom 25% → dies
const BOTTOM_RANK_CUTOFF = 0.75; // bottom 25%

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function resolveTournamentDeaths(
  standings: TournamentStanding[],
): DeathVerdict[] {
  const verdicts: DeathVerdict[] = [];

  for (const standing of standings) {
    // rankScore: 0 = best, 1 = worst
    const rankScore =
      standing.totalParticipants > 1
        ? (standing.finalRank - 1) / (standing.totalParticipants - 1)
        : 0;

    // Average HP% across all creatures
    const creatureCount = standing.creatures.length;
    const avgHpPercent =
      creatureCount > 0
        ? standing.creatures.reduce((sum, c) => sum + c.hpPercent, 0) /
          creatureCount
        : 100;

    const damageScore = 1 - avgHpPercent / 100;
    const compositeScore = rankScore * RANK_WEIGHT + damageScore * DAMAGE_WEIGHT;

    // Safe zone: top performers
    if (compositeScore <= DEATH_THRESHOLD) continue;

    // Is this participant in the bottom 25% of rankings?
    const isBottomRank = rankScore >= BOTTOM_RANK_CUTOFF;

    // Find the most damaged creature (lowest hpPercent)
    const sorted = [...standing.creatures].sort(
      (a, b) => a.hpPercent - b.hpPercent,
    );

    for (const creature of sorted) {
      // Founders are immune to tournament death
      if (creature.isFounder) continue;

      if (creature.hpPercent <= CRITICAL_HP) {
        verdicts.push({ creatureId: creature.id, cause: 'tournament_damage' });
        break; // only the most damaged creature dies per participant
      }

      if (creature.hpPercent <= DANGER_HP && isBottomRank) {
        verdicts.push({ creatureId: creature.id, cause: 'tournament_damage' });
        break;
      }

      // No death for this participant (most damaged didn't qualify)
      break;
    }
  }

  return verdicts;
}
