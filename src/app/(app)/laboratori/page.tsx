import { redirect } from 'next/navigation';
import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { users, creatures, creatureRankings } from '@/lib/db/schema';
import { eq, and, sql, gte, desc } from 'drizzle-orm';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import { calculateSynergies } from '@/lib/game-engine/synergy-system';
import { SYNERGIES, COMBAT_TRAITS } from '@/lib/game-engine/constants';
import type { TraitValues, ElementLevels } from '@/types/game';
import { LaboratoriDirectory } from '@/components/lab/laboratori-directory';
import type { LaboratoriCreature } from '@/components/lab/laboratori-directory';
import { allocations } from '@/lib/db/schema';
import { calculateWellness } from '@/lib/game-engine/wellness';
import { TIME_CONFIG } from '@/lib/game-engine/time-config';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Potenza Score Calculation
// ---------------------------------------------------------------------------

function calculatePotenza(
  traitValues: TraitValues,
  ranking: { eloRating: number } | null,
): number {
  const bodySize = traitValues.bodySize ?? 0;
  const headSize = traitValues.headSize ?? 0;
  const limbGrowth = traitValues.limbGrowth ?? 0;
  const eyeDev = traitValues.eyeDev ?? 0;
  const posture = traitValues.posture ?? 0;

  const attackPower = traitValues.attackPower ?? 0;
  const defense = traitValues.defense ?? 0;
  const speed = traitValues.speed ?? 0;
  const stamina = traitValues.stamina ?? 0;
  const specialAttack = traitValues.specialAttack ?? 0;
  const battleScars = traitValues.battleScars ?? 0;

  const eloRating = ranking?.eloRating ?? 1000;

  return Math.round(
    (bodySize + headSize + limbGrowth + eyeDev + posture) * 0.3
    + (attackPower + defense + speed + stamina + specialAttack) * 0.5
    + battleScars * 0.2
    + (eloRating - 1000) * 0.1,
  );
}

// ---------------------------------------------------------------------------
// Level badge from age
// ---------------------------------------------------------------------------

function getLevelFromAge(ageDays: number): string {
  if (ageDays >= 500) return 'divine';
  if (ageDays >= 300) return 'immortal';
  if (ageDays > 150) return 'legend';
  if (ageDays > 100) return 'veteran';
  if (ageDays > 60) return 'intermediate';
  if (ageDays >= 40) return 'novice';
  return 'embryo';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function LaboratoriPage() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    redirect('/login');
  }

  // 1. Fetch all active (non-archived) creatures with their users
  const allCreatures = await db
    .select()
    .from(creatures)
    .where(eq(creatures.isArchived, false));

  // 2. Fetch all users
  const allUsers = await db.select().from(users);
  const usersMap = new Map(allUsers.map((u) => [u.id, u]));

  // 3. Fetch all rankings
  const allRankings = await db.select().from(creatureRankings);
  const rankingsMap = new Map(allRankings.map((r) => [r.creatureId, r]));

  // 4. Batch load wellness data for all creatures
  const now = new Date();
  const timeScale = TIME_CONFIG.isDevMode ? 480 : 1;
  const activityWindowMs = (72 * 60 * 60 * 1000) / timeScale;
  const windowStart = new Date(now.getTime() - activityWindowMs);
  const allCreatureIds = allCreatures.map((c) => c.id);

  const idsArray = sql`ARRAY[${sql.join(allCreatureIds.map(id => sql`${id}::uuid`), sql`, `)}]`;
  const windowStartIso = windowStart.toISOString();
  const [lastInjResults, recentCountResults] = allCreatureIds.length > 0 ? await Promise.all([
    db.execute(sql`
      SELECT DISTINCT ON (creature_id) creature_id, created_at
      FROM allocations WHERE creature_id = ANY(${idsArray})
      ORDER BY creature_id, created_at DESC
    `) as Promise<{ creature_id: string; created_at: Date }[]>,
    db.execute(sql`
      SELECT creature_id, count(*) as cnt FROM allocations
      WHERE creature_id = ANY(${idsArray}) AND created_at >= ${windowStartIso}::timestamptz
      GROUP BY creature_id
    `) as Promise<{ creature_id: string; cnt: string }[]>,
  ]) : [[] as { creature_id: string; created_at: Date }[], [] as { creature_id: string; cnt: string }[]];

  const lastInjMap = new Map<string, Date>();
  for (const row of lastInjResults) {
    lastInjMap.set(row.creature_id, new Date(row.created_at));
  }
  const recentCountMap = new Map<string, number>();
  for (const row of recentCountResults) {
    recentCountMap.set(row.creature_id, Number(row.cnt));
  }

  // 5. Build creature data with recalculated visuals and potenza
  const creaturesData: LaboratoriCreature[] = allCreatures
    .map((c) => {
      const user = usersMap.get(c.userId);
      if (!user) return null;

      const ranking = rankingsMap.get(c.id);
      const traitValues = c.traitValues as TraitValues;
      const elementLevels = c.elementLevels as ElementLevels;

      // Recalculate visual params from traits (same approach as admin)
      const visualParams = mapTraitsToVisuals(traitValues, elementLevels, [], c.foundingElements ?? null, c.growthElements ?? null);

      // Calculate potenza
      const potenza = calculatePotenza(traitValues, ranking ?? null);

      // Get active synergy names
      const synergyResult = calculateSynergies(elementLevels, c.id, c.ageDays ?? 0);
      const activeSynergies = synergyResult.activeSynergies.map((s) => s.name);

      // Level from age
      const ageDays = c.ageDays ?? 0;
      const level = getLevelFromAge(ageDays);

      // Approximate combat traits (round to nearest 5 for mystery)
      const combatApprox: Record<string, number> = {};
      for (const ct of COMBAT_TRAITS) {
        const raw = (traitValues as Record<string, number>)[ct] ?? 0;
        combatApprox[ct] = Math.round(raw / 5) * 5;
      }

      return {
        id: c.id,
        name: c.name,
        ownerName: user.displayName,
        ageDays,
        generation: c.generation ?? 1,
        stability: c.stability ?? 0.5,
        level,
        potenza,
        visualParams: visualParams as unknown as Record<string, unknown>,
        elementLevels: elementLevels as Record<string, number>,
        activeSynergies,
        combatApprox,
        arena: ranking
          ? {
              eloRating: ranking.eloRating,
              wins: ranking.wins,
              losses: ranking.losses,
              draws: ranking.draws,
              winStreak: ranking.winStreak,
              tier: ranking.rankTier,
            }
          : null,
        wellness: calculateWellness({
          lastInjectionAt: lastInjMap.get(c.id) ?? null,
          recentInjectionCount: recentCountMap.get(c.id) ?? 0,
          lastBattleAt: ranking?.lastBattleAt ?? null,
          battlesToday: ranking?.battlesToday ?? 0,
          now,
        }),
      };
    })
    .filter((c) => c !== null)
    .sort((a, b) => b!.potenza - a!.potenza) as LaboratoriCreature[];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-foreground">
          I Laboratori
        </h1>
        <p className="mt-0.5 text-xs text-muted">
          Tutte le creature di Mutagenix. Esplora gli esperimenti degli altri scienziati.
        </p>
      </div>
      <LaboratoriDirectory creatures={creaturesData} />
    </div>
  );
}
