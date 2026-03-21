import { redirect } from 'next/navigation';
import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { users, creatures, allocations, creatureRankings } from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { AdminDashboard } from '@/components/admin/admin-dashboard';

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

  // Fetch all users with their creatures (LEFT JOIN)
  const usersWithCreatures = await db
    .select({
      user: users,
      creature: creatures,
    })
    .from(users)
    .leftJoin(creatures, eq(creatures.userId, users.id))
    .orderBy(desc(users.createdAt));

  // Fetch allocation counts per creature
  const allocationCounts = await db
    .select({
      creatureId: allocations.creatureId,
      count: sql<number>`count(*)::int`,
    })
    .from(allocations)
    .groupBy(allocations.creatureId);

  const allocationMap = new Map(
    allocationCounts.map((a) => [a.creatureId, a.count]),
  );

  // Fetch rankings for all creatures
  const rankingsData = await db.select().from(creatureRankings);
  const rankingsMap = new Map(
    rankingsData.map((r) => [r.creatureId, r]),
  );

  // Build the data structure for the client component
  const data = usersWithCreatures.map((row) => {
    const ranking = row.creature ? rankingsMap.get(row.creature.id) : null;
    return {
      user: {
        id: row.user.id,
        email: row.user.email,
        displayName: row.user.displayName,
        streak: row.user.streak ?? 0,
        lastLoginAt: row.user.lastLoginAt?.toISOString() ?? null,
        isAdmin: row.user.isAdmin ?? false,
        createdAt: row.user.createdAt.toISOString(),
      },
      creature: row.creature
        ? {
            id: row.creature.id,
            name: row.creature.name,
            generation: row.creature.generation ?? 1,
            ageDays: row.creature.ageDays ?? 0,
            stability: row.creature.stability ?? 0.5,
            elementLevels: row.creature.elementLevels,
            traitValues: row.creature.traitValues,
            visualParams: row.creature.visualParams as Record<string, unknown>,
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
          }
        : null,
      allocationCount: row.creature
        ? (allocationMap.get(row.creature.id) ?? 0)
        : 0,
    };
  });

  // Compute stats
  const totalUsers = data.length;
  const totalCreatures = data.filter((d) => d.creature !== null).length;
  const totalInjections = allocationCounts.reduce(
    (sum, a) => sum + a.count,
    0,
  );
  const mostEvolved = data.reduce<(typeof data)[number] | null>((best, d) => {
    if (!d.creature) return best;
    if (!best || !best.creature) return d;
    return d.creature.ageDays > best.creature.ageDays ? d : best;
  }, null);

  return (
    <AdminDashboard
      data={data}
      stats={{
        totalUsers,
        totalCreatures,
        totalInjections,
        mostEvolvedName: mostEvolved?.creature?.name ?? null,
        mostEvolvedDays: mostEvolved?.creature?.ageDays ?? 0,
      }}
    />
  );
}
