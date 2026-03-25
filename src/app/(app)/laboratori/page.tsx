import { redirect } from 'next/navigation';
import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { users, creatures, creatureRankings, cariche, clanMemberships, clans } from '@/lib/db/schema';
import { eq, and, sql, gte, gt, desc } from 'drizzle-orm';
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

  // Detect bot users
  const botUserIds = new Set<string>();
  for (const u of allUsers) {
    if (u.email?.includes('@mutagenix.io')) botUserIds.add(u.id);
  }

  // 3. Fetch all rankings
  const allRankings = await db.select().from(creatureRankings);
  const rankingsMap = new Map(allRankings.map((r) => [r.creatureId, r]));

  // 4. Batch load wellness data for all creatures using ORM queries
  const now = new Date();
  const timeScale = TIME_CONFIG.isDevMode ? 30 : 1;
  const activityWindowMs = (7 * 24 * 60 * 60 * 1000) / timeScale;
  const windowStart = new Date(now.getTime() - activityWindowMs);

  // Fetch all allocations' latest timestamp per creature + recent count
  const allAllocations = await db
    .select({
      creatureId: allocations.creatureId,
      createdAt: allocations.createdAt,
    })
    .from(allocations);

  // Build maps from allocations data
  const lastInjMap = new Map<string, Date>();
  const recentCountMap = new Map<string, number>();
  for (const a of allAllocations) {
    // Track most recent injection
    const existing = lastInjMap.get(a.creatureId);
    if (!existing || a.createdAt > existing) {
      lastInjMap.set(a.creatureId, a.createdAt);
    }
    // Count recent injections
    if (a.createdAt >= windowStart) {
      recentCountMap.set(a.creatureId, (recentCountMap.get(a.creatureId) ?? 0) + 1);
    }
  }

  // 5. Build parent name lookup
  const parentIds = new Set<string>();
  for (const c of allCreatures) {
    if (c.parentACreatureId) parentIds.add(c.parentACreatureId);
    if (c.parentBCreatureId) parentIds.add(c.parentBCreatureId);
  }
  const parentNameMap = new Map<string, string>();
  // Most parents are already in allCreatures
  for (const c of allCreatures) {
    if (parentIds.has(c.id)) parentNameMap.set(c.id, c.name);
  }

  // 6. Batch load active cariche
  const allCariche = await db.select({
    creatureId: cariche.creatureId,
    caricaId: cariche.caricaId,
  }).from(cariche).where(gt(cariche.expiresAt, sql`NOW()`));

  const caricheMap = new Map<string, string[]>();
  for (const c of allCariche) {
    const arr = caricheMap.get(c.creatureId) ?? [];
    arr.push(c.caricaId);
    caricheMap.set(c.creatureId, arr);
  }

  // 7. Batch load clan memberships
  const allClanMemberships = await db
    .select({
      creatureId: clanMemberships.creatureId,
      clanName: clans.name,
      emblemColor: clans.emblemColor,
      role: clanMemberships.role,
    })
    .from(clanMemberships)
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId));

  const clanMap = new Map<string, { name: string; emblemColor: string; role: string }>();
  for (const cm of allClanMemberships) {
    clanMap.set(cm.creatureId, {
      name: cm.clanName,
      emblemColor: cm.emblemColor ?? '#6b7280',
      role: cm.role,
    });
  }

  // 8. Build creature data with recalculated visuals and potenza
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
        cariche: caricheMap.get(c.id) ?? [],
        isDead: c.isDead,
        isBot: botUserIds.has(c.userId),
        familyGeneration: c.familyGeneration,
        parentNames: (c.parentACreatureId || c.parentBCreatureId) ? {
          parentA: c.parentACreatureId ? parentNameMap.get(c.parentACreatureId) ?? null : null,
          parentB: c.parentBCreatureId ? parentNameMap.get(c.parentBCreatureId) ?? null : null,
        } : null,
        clanInfo: clanMap.get(c.id) ?? null,
      };
    })
    .filter((c) => c !== null)
    .sort((a, b) => b!.potenza - a!.potenza) as LaboratoriCreature[];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4">
      <LaboratoriDirectory creatures={creaturesData} />
    </div>
  );
}
