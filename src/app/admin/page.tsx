import { redirect } from 'next/navigation';
import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { users, creatures, creatureRankings } from '@/lib/db/schema';
import { sql, desc, asc } from 'drizzle-orm';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import type { TraitValues, ElementLevels } from '@/types/game';

export default async function AdminPage() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    redirect('/lab');
  }

  if (!session.isAdmin) {
    redirect('/lab');
  }

  // 1. Fetch all users
  const allUsers = await db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt));

  // 2. Fetch ALL creatures (active + archived), ordered: active first, then archived by archivedAt DESC
  const allCreatures = await db
    .select()
    .from(creatures)
    .orderBy(asc(creatures.isArchived), desc(creatures.archivedAt), desc(creatures.createdAt));

  // 3. Fetch all rankings
  const allRankings = await db.select().from(creatureRankings);
  const rankingsMap = new Map(
    allRankings.map((r) => [r.creatureId, r]),
  );

  // 4. Count battles per user (as challenger or defender)
  const battleCounts = await db
    .select({
      userId: sql<string>`user_id`,
      count: sql<number>`count(*)::int`,
    })
    .from(
      sql`(
        SELECT challenger_user_id AS user_id FROM battles
        UNION ALL
        SELECT defender_user_id AS user_id FROM battles
      ) AS user_battles`,
    )
    .groupBy(sql`user_id`);

  const battleCountMap = new Map(
    battleCounts.map((b) => [b.userId, b.count]),
  );

  // 5. Group creatures by userId
  const creaturesByUser = new Map<string, typeof allCreatures>();
  for (const creature of allCreatures) {
    const list = creaturesByUser.get(creature.userId) ?? [];
    list.push(creature);
    creaturesByUser.set(creature.userId, list);
  }

  // 6. Build structured data
  const data = allUsers.map((user) => {
    const userCreatures = creaturesByUser.get(user.id) ?? [];

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isAdmin: user.isAdmin ?? false,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      totalBattles: battleCountMap.get(user.id) ?? 0,
      creatures: userCreatures.map((c) => {
        const ranking = rankingsMap.get(c.id);
        return {
          id: c.id,
          name: c.name,
          ageDays: c.ageDays ?? 0,
          generation: c.generation ?? 1,
          stability: c.stability ?? 0.5,
          isArchived: c.isArchived,
          archiveReason: c.archiveReason,
          archivedAt: c.archivedAt?.toISOString() ?? null,
          elementLevels: c.elementLevels,
          traitValues: c.traitValues,
          visualParams: mapTraitsToVisuals(
            c.traitValues as TraitValues,
            c.elementLevels as ElementLevels,
            [],
            c.foundingElements ?? null,
            c.growthElements ?? null,
          ) as unknown as Record<string, unknown>,
          ranking: ranking
            ? {
                eloRating: ranking.eloRating,
                wins: ranking.wins,
                losses: ranking.losses,
                draws: ranking.draws,
                winStreak: ranking.winStreak,
                tier: ranking.rankTier,
                recoveryUntil: ranking.recoveryUntil?.toISOString() ?? null,
                traumaActive: ranking.traumaActive,
                consecutiveLosses: ranking.consecutiveLosses,
              }
            : null,
        };
      }),
    };
  });

  // 7. Compute stats
  const totalUsers = allUsers.length;
  const activeCreatures = allCreatures.filter((c) => !c.isArchived).length;
  const archivedCreatures = allCreatures.filter((c) => c.isArchived).length;
  const totalBattles = battleCounts.reduce((sum, b) => sum + b.count, 0) / 2; // each battle counted twice (challenger + defender)
  const warriorsInArena = allRankings.length;

  return (
    <AdminDashboard
      data={data}
      stats={{
        totalUsers,
        activeCreatures,
        archivedCreatures,
        totalBattles: Math.round(totalBattles),
        warriorsInArena,
      }}
    />
  );
}
