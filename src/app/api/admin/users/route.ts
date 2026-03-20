import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { users, creatures, allocations } from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

export async function GET() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  if (!session.isAdmin) {
    return forbiddenResponse('Accesso riservato agli admin');
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

  const data = usersWithCreatures.map((row) => ({
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
          visualParams: row.creature.visualParams,
        }
      : null,
    allocationCount: row.creature
      ? (allocationMap.get(row.creature.id) ?? 0)
      : 0,
  }));

  return NextResponse.json({ data });
}
