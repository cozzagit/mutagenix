// ---------------------------------------------------------------------------
// Mutagenix – Tournament Engine (pure, no DB)
// ---------------------------------------------------------------------------
// Manages tournament lifecycle: bracket generation, round-robin scheduling,
// round advancement, and final standings calculation.
// ---------------------------------------------------------------------------

export interface BracketMatch {
  roundNumber: number;
  participant1Id: string;
  participant2Id: string;
  isBye: boolean;
}

// ---------------------------------------------------------------------------
// Knockout Bracket
// ---------------------------------------------------------------------------

/**
 * Generate a knockout bracket from participants, seeded by ELO.
 * 1. Sort participants by ELO descending (highest = seed 1).
 * 2. Pad to next power of 2 with byes.
 * 3. Pair: seed 1 vs last, seed 2 vs second-to-last, etc.
 */
export function generateKnockoutBracket(
  participants: Array<{ id: string; eloRating: number }>,
): BracketMatch[] {
  if (participants.length < 2) return [];

  // Sort by ELO descending
  const sorted = [...participants].sort((a, b) => b.eloRating - a.eloRating);

  // Pad to next power of 2
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(sorted.length)));
  const byeCount = nextPow2 - sorted.length;

  // Create full list with BYE placeholders
  const seeded: Array<{ id: string; isBye: boolean }> = sorted.map((p) => ({
    id: p.id,
    isBye: false,
  }));

  for (let i = 0; i < byeCount; i++) {
    seeded.push({ id: `BYE_${i}`, isBye: true });
  }

  // Pair: seed 1 vs last, seed 2 vs second-to-last, etc.
  const matches: BracketMatch[] = [];
  const halfSize = seeded.length / 2;

  for (let i = 0; i < halfSize; i++) {
    const top = seeded[i];
    const bottom = seeded[seeded.length - 1 - i];

    matches.push({
      roundNumber: 1,
      participant1Id: top.id,
      participant2Id: bottom.id,
      isBye: top.isBye || bottom.isBye,
    });
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Calendar (Round-Robin) Schedule
// ---------------------------------------------------------------------------

/**
 * Generate a calendar (round-robin) schedule where each participant plays
 * every other exactly once. Uses the classic circle method.
 */
export function generateCalendarSchedule(
  participants: Array<{ id: string }>,
  matchesPerDay: number,
): BracketMatch[] {
  if (participants.length < 2) return [];

  const ids = participants.map((p) => p.id);

  // If odd number, add a BYE
  if (ids.length % 2 !== 0) {
    ids.push('BYE_RR');
  }

  const n = ids.length;
  const totalRounds = n - 1;
  const matchesPerRound = n / 2;
  const allMatches: BracketMatch[] = [];

  // Circle method: fix first element, rotate the rest
  const fixed = ids[0];
  const rotating = ids.slice(1);

  for (let round = 0; round < totalRounds; round++) {
    const currentOrder = [fixed, ...rotating];

    for (let i = 0; i < matchesPerRound; i++) {
      const p1 = currentOrder[i];
      const p2 = currentOrder[n - 1 - i];

      const isBye = p1.startsWith('BYE_') || p2.startsWith('BYE_');

      allMatches.push({
        roundNumber: round + 1,
        participant1Id: p1,
        participant2Id: p2,
        isBye,
      });
    }

    // Rotate: move last element to front of rotating array
    rotating.unshift(rotating.pop()!);
  }

  // Redistribute into "days" based on matchesPerDay
  if (matchesPerDay > 0) {
    let dayNumber = 1;
    let matchesInDay = 0;

    for (const match of allMatches) {
      if (match.isBye) continue; // skip byes for day counting

      if (matchesInDay >= matchesPerDay) {
        dayNumber++;
        matchesInDay = 0;
      }

      match.roundNumber = dayNumber;
      matchesInDay++;
    }
  }

  // Filter out BYE matches for calendar (they're just rest days)
  return allMatches.filter((m) => !m.isBye);
}

// ---------------------------------------------------------------------------
// Advance Knockout Round
// ---------------------------------------------------------------------------

/**
 * Calculate next round for knockout by pairing winners.
 * Winners from consecutive matches in the current round are paired together.
 */
export function advanceKnockoutRound(
  currentRound: number,
  completedMatches: Array<{
    participant1Id: string;
    participant2Id: string;
    winnerId: string | null;
  }>,
): BracketMatch[] {
  // Collect winners in match order
  const winners: string[] = [];

  for (const match of completedMatches) {
    if (match.winnerId) {
      winners.push(match.winnerId);
    } else {
      // Draw in knockout: participant1 advances (higher seed was placed first)
      winners.push(match.participant1Id);
    }
  }

  if (winners.length < 2) return []; // Tournament is over (final was played)

  // Pair consecutive winners
  const nextMatches: BracketMatch[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (i + 1 < winners.length) {
      nextMatches.push({
        roundNumber: currentRound + 1,
        participant1Id: winners[i],
        participant2Id: winners[i + 1],
        isBye: false,
      });
    }
  }

  return nextMatches;
}

// ---------------------------------------------------------------------------
// Calculate Standings
// ---------------------------------------------------------------------------

/**
 * Calculate final standings from tournament data.
 * Sort by points descending, then by totalDamageTaken ascending (less = better).
 */
export function calculateStandings(
  participants: Array<{
    id: string;
    points: number;
    matchesWon: number;
    totalDamageTaken: number;
  }>,
): Array<{ participantId: string; rank: number }> {
  const sorted = [...participants].sort((a, b) => {
    // Primary: points (higher = better)
    if (b.points !== a.points) return b.points - a.points;
    // Secondary: matchesWon (higher = better)
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
    // Tertiary: totalDamageTaken (lower = better)
    return a.totalDamageTaken - b.totalDamageTaken;
  });

  return sorted.map((p, i) => ({
    participantId: p.id,
    rank: i + 1,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate the total number of rounds for a knockout tournament.
 */
export function calculateKnockoutRounds(participantCount: number): number {
  if (participantCount < 2) return 0;
  return Math.ceil(Math.log2(participantCount));
}

/**
 * Points system for calendar tournaments.
 */
export const CALENDAR_POINTS = {
  WIN: 3,
  DRAW: 1,
  LOSS: 0,
} as const;

/**
 * Points system for knockout tournaments.
 */
export const KNOCKOUT_POINTS = {
  WIN: 1,
  LOSS: 0,
} as const;
