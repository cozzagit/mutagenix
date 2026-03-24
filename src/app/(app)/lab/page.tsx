import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, battles, creatureRankings, users } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { LabDashboard } from '@/components/lab/lab-dashboard';
import { interpolateCreatureState } from '@/lib/game-engine/interpolation';
import { finalizeIfExpired } from '@/lib/game-engine/auto-finalize';
import { TIME_CONFIG } from '@/lib/game-engine/time-config';
import { loadWellnessInput } from '@/lib/game-engine/wellness-loader';
import { calculateWellness } from '@/lib/game-engine/wellness';

export const dynamic = 'force-dynamic';

export default async function LabPage() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    redirect('/login');
  }

  // Use active_creature_id if set, otherwise fall back to first non-archived
  const [user] = await db.select({ activeCreatureId: users.activeCreatureId })
    .from(users).where(eq(users.id, session.userId));

  let [creature] = user?.activeCreatureId
    ? await db.select().from(creatures).where(eq(creatures.id, user.activeCreatureId))
    : await db.select().from(creatures)
        .where(and(eq(creatures.userId, session.userId), eq(creatures.isArchived, false)));

  if (!creature) redirect('/login');

  // Auto-finalize if mutation has expired
  creature = await finalizeIfExpired(creature);

  // Compute interpolated visible state
  const now = new Date();
  const interpolated = interpolateCreatureState(creature, now);

  // Can allocate if: no active mutation AND cooldown passed
  let canAllocate = !interpolated.mutationActive;
  if (canAllocate && creature.updatedAt && (creature.ageDays ?? 0) > 0) {
    const timeSinceUpdate = Date.now() - creature.updatedAt.getTime();
    if (timeSinceUpdate < TIME_CONFIG.COOLDOWN_MS) {
      canAllocate = false;
    }
  }

  // Cooldown remaining
  let cooldownRemaining = 0;
  if (!canAllocate && !interpolated.mutationActive && creature.updatedAt) {
    cooldownRemaining = Math.max(0, TIME_CONFIG.COOLDOWN_MS - (Date.now() - creature.updatedAt.getTime()));
  }

  // Fetch unseen battles (defender battles AFTER last arena visit) with details
  let unseenBattles = 0;
  let unseenBattleDetails: Array<{ battleId: string; attackerCreatureName: string; defenderCreatureName: string; won: boolean; date: string }> = [];
  try {
    const [userRow] = await db.select({ lastArenaVisit: users.lastArenaVisit })
      .from(users).where(eq(users.id, session.userId));
    const threshold = userRow?.lastArenaVisit ?? new Date(0);

    const unseenRows = await db
      .select({
        id: battles.id,
        challengerCreatureId: battles.challengerCreatureId,
        defenderCreatureId: battles.defenderCreatureId,
        winnerCreatureId: battles.winnerCreatureId,
        createdAt: battles.createdAt,
      })
      .from(battles)
      .where(
        and(
          eq(battles.defenderUserId, session.userId),
          gte(battles.createdAt, threshold),
          eq(battles.battleMode, 'ranked'),
        ),
      )
      .orderBy(sql`${battles.createdAt} DESC`)
      .limit(10);

    unseenBattles = unseenRows.length;

    if (unseenRows.length > 0) {
      // Fetch creature names for the battles
      const creatureIds = new Set<string>();
      for (const b of unseenRows) {
        creatureIds.add(b.challengerCreatureId);
        creatureIds.add(b.defenderCreatureId);
      }
      const creatureNames = await db.select({ id: creatures.id, name: creatures.name })
        .from(creatures)
        .where(sql`${creatures.id} IN (${sql.join([...creatureIds].map(id => sql`${id}`), sql`, `)})`);
      const nameMap = new Map(creatureNames.map(c => [c.id, c.name]));

      unseenBattleDetails = unseenRows.map(b => ({
        battleId: b.id,
        attackerCreatureName: nameMap.get(b.challengerCreatureId) ?? 'Sconosciuto',
        defenderCreatureName: nameMap.get(b.defenderCreatureId) ?? 'Sconosciuto',
        won: b.winnerCreatureId === b.defenderCreatureId,
        date: b.createdAt.toISOString(),
      }));
    }
  } catch {
    // Arena tables may not exist yet — ignore
  }

  // Fetch arena ranking
  let ranking: { eloRating: number; wins: number; losses: number; draws: number; tier: string; axp?: number } | null = null;
  try {
    const [r] = await db.select({
      eloRating: creatureRankings.eloRating,
      wins: creatureRankings.wins,
      losses: creatureRankings.losses,
      draws: creatureRankings.draws,
      tier: creatureRankings.rankTier,
      axp: creatureRankings.axp,
    }).from(creatureRankings).where(eq(creatureRankings.creatureId, creature.id));
    ranking = r ?? null;
  } catch { /* table may not exist */ }

  // Load wellness
  const wellnessInput = await loadWellnessInput(creature.id);
  const wellness = calculateWellness(wellnessInput);

  return (
    <LabDashboard
      creature={creature}
      todayAllocation={null}
      canAllocate={canAllocate}
      mutationActive={interpolated.mutationActive}
      mutationProgress={interpolated.progress}
      currentVisualParams={interpolated.visualParams as unknown as Record<string, unknown>}
      currentElementLevels={interpolated.elementLevels as Record<string, number>}
      timeUntilNextDay={0}
      dayKey={String(creature.ageDays ?? 0)}
      isDevMode={TIME_CONFIG.isDevMode}
      cooldownRemaining={cooldownRemaining}
      unseenBattles={unseenBattles}
      unseenBattleDetails={unseenBattleDetails}
      ranking={ranking}
      wellness={wellness}
    />
  );
}
