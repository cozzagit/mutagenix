import { redirect } from 'next/navigation';
import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { users, creatures, creatureRankings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import { calculateSynergies } from '@/lib/game-engine/synergy-system';
import { SYNERGIES, COMBAT_TRAITS } from '@/lib/game-engine/constants';
import type { TraitValues, ElementLevels } from '@/types/game';
import { LaboratoriDirectory } from '@/components/lab/laboratori-directory';
import type { LaboratoriCreature } from '@/components/lab/laboratori-directory';

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

  // 4. Build creature data with recalculated visuals and potenza
  const creaturesData: LaboratoriCreature[] = allCreatures
    .map((c) => {
      const user = usersMap.get(c.userId);
      if (!user) return null;

      const ranking = rankingsMap.get(c.id);
      const traitValues = c.traitValues as TraitValues;
      const elementLevels = c.elementLevels as ElementLevels;

      // Recalculate visual params from traits (same approach as admin)
      const visualParams = mapTraitsToVisuals(traitValues, elementLevels, []);

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
      };
    })
    .filter((c): c is LaboratoriCreature => c !== null)
    .sort((a, b) => b.potenza - a.potenza);

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
