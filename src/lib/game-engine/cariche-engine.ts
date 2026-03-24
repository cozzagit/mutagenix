// ---------------------------------------------------------------------------
// Mutagenix – Cariche Engine (pure, no DB)
// ---------------------------------------------------------------------------
// Calculates the 7 "Cariche del Laboratorio" from pre-loaded data.
// ---------------------------------------------------------------------------

export interface CaricaCandidate {
  caricaId: string;
  creatureId: string;
  userId: string;
  metricValue: number;
}

export interface CaricaCreature {
  id: string;
  userId: string;
  ageDays: number;
  stability: number;
  traitValues: Record<string, number>;
  elementLevels: Record<string, number>;
  isArchived: boolean;
  isDead: boolean;
}

export interface CaricaRanking {
  creatureId: string;
  eloRating: number;
  wins: number;
  winStreak: number;
  axp: number;
}

export interface CaricaInput {
  creatures: CaricaCreature[];
  rankings: CaricaRanking[];
  weeklyEloDelta: Map<string, number>;
  weeklyBattleCount: Map<string, number>;
  wellnessScores: Map<string, number>;
  synergyCount: Map<string, number>;
  offspringCount: Map<string, { userId: string; count: number }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function eligible(c: CaricaCreature): boolean {
  return !c.isArchived && !c.isDead;
}

// ---------------------------------------------------------------------------
// Main calculator
// ---------------------------------------------------------------------------

export function calculateCariche(input: CaricaInput): CaricaCandidate[] {
  const {
    creatures,
    rankings: _rankings,
    weeklyEloDelta,
    weeklyBattleCount,
    wellnessScores,
    synergyCount,
    offspringCount,
  } = input;

  const alive = creatures.filter(eligible);
  const results: CaricaCandidate[] = [];

  // Build ranking map for quick lookup
  const rankingMap = new Map<string, CaricaRanking>();
  for (const r of _rankings) {
    rankingMap.set(r.creatureId, r);
  }

  // --- 1. Primario: highest wellness composite ---
  {
    let best: CaricaCreature | null = null;
    let bestVal = -1;
    for (const c of alive) {
      const val = wellnessScores.get(c.id) ?? 0;
      if (val > bestVal || (val === bestVal && best && c.ageDays > best.ageDays)) {
        best = c;
        bestVal = val;
      }
    }
    if (best && bestVal > 0) {
      results.push({ caricaId: 'primario', creatureId: best.id, userId: best.userId, metricValue: bestVal });
    }
  }

  // --- 2. Console: highest weekly ELO delta, min 5 battles ---
  {
    let best: CaricaCreature | null = null;
    let bestVal = -Infinity;
    for (const c of alive) {
      const battles = weeklyBattleCount.get(c.id) ?? 0;
      if (battles < 5) continue;
      const delta = weeklyEloDelta.get(c.id) ?? 0;
      const ranking = rankingMap.get(c.id);
      const streak = ranking?.winStreak ?? 0;
      if (delta > bestVal || (delta === bestVal && best && streak > (rankingMap.get(best.id)?.winStreak ?? 0))) {
        best = c;
        bestVal = delta;
      }
    }
    if (best && bestVal > -Infinity) {
      results.push({ caricaId: 'console', creatureId: best.id, userId: best.userId, metricValue: bestVal });
    }
  }

  // --- 3. Pontefice: highest luminosity ---
  {
    let best: CaricaCreature | null = null;
    let bestVal = -1;
    for (const c of alive) {
      const val = c.traitValues.luminosity ?? 0;
      if (val > bestVal || (val === bestVal && best && c.stability > best.stability)) {
        best = c;
        bestVal = val;
      }
    }
    if (best && bestVal > 0) {
      results.push({ caricaId: 'pontefice', creatureId: best.id, userId: best.userId, metricValue: bestVal });
    }
  }

  // --- 4. Tossicarca: highest toxicity ---
  {
    let best: CaricaCreature | null = null;
    let bestVal = -1;
    for (const c of alive) {
      const val = c.traitValues.toxicity ?? 0;
      const syn = synergyCount.get(c.id) ?? 0;
      if (val > bestVal || (val === bestVal && best && syn > (synergyCount.get(best.id) ?? 0))) {
        best = c;
        bestVal = val;
      }
    }
    if (best && bestVal > 0) {
      results.push({ caricaId: 'tossicarca', creatureId: best.id, userId: best.userId, metricValue: bestVal });
    }
  }

  // --- 5. Patriarca: user with most living offspring, award to their most senior creature ---
  {
    // Count living offspring per user
    const userOffspring = new Map<string, number>();
    for (const [_creatureId, info] of offspringCount) {
      const current = userOffspring.get(info.userId) ?? 0;
      userOffspring.set(info.userId, current + info.count);
    }

    let bestUserId: string | null = null;
    let bestCount = 0;
    for (const [userId, count] of userOffspring) {
      if (count > bestCount) {
        bestUserId = userId;
        bestCount = count;
      }
    }

    if (bestUserId && bestCount >= 2) {
      // Find this user's most senior alive creature
      const userCreatures = alive
        .filter((c) => c.userId === bestUserId)
        .sort((a, b) => b.ageDays - a.ageDays);

      if (userCreatures.length > 0) {
        const best = userCreatures[0];
        results.push({ caricaId: 'patriarca', creatureId: best.id, userId: best.userId, metricValue: bestCount });
      }
    }
  }

  // --- 6. Custode: highest stability, min 40 days ---
  {
    let best: CaricaCreature | null = null;
    let bestVal = -1;
    for (const c of alive) {
      if (c.ageDays < 40) continue;
      const val = c.stability;
      const syn = synergyCount.get(c.id) ?? 0;
      if (val > bestVal || (val === bestVal && best && syn > (synergyCount.get(best.id) ?? 0))) {
        best = c;
        bestVal = val;
      }
    }
    if (best && bestVal > 0) {
      results.push({ caricaId: 'custode', creatureId: best.id, userId: best.userId, metricValue: bestVal });
    }
  }

  // --- 7. Alchimista: highest synergy count ---
  {
    let best: CaricaCreature | null = null;
    let bestVal = -1;
    for (const c of alive) {
      const val = synergyCount.get(c.id) ?? 0;
      const elSum = Object.values(c.elementLevels).reduce((s, v) => s + v, 0);
      if (val > bestVal || (val === bestVal && best && elSum > Object.values(best.elementLevels).reduce((s, v) => s + v, 0))) {
        best = c;
        bestVal = val;
      }
    }
    if (best && bestVal > 0) {
      results.push({ caricaId: 'alchimista', creatureId: best.id, userId: best.userId, metricValue: bestVal });
    }
  }

  return results;
}
