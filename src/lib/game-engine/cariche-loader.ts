// ---------------------------------------------------------------------------
// Mutagenix – Cariche Loader
// ---------------------------------------------------------------------------
// Loads cariche data from DB for use in other systems (battle, allocations).
// ---------------------------------------------------------------------------

import { db } from '@/lib/db';
import { cariche, creatures, users } from '@/lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';

/**
 * Returns array of carica IDs held by this creature.
 */
export async function getCreatureCariche(creatureId: string): Promise<string[]> {
  const now = new Date();
  const rows = await db
    .select({ caricaId: cariche.caricaId })
    .from(cariche)
    .where(
      and(
        eq(cariche.creatureId, creatureId),
        gte(cariche.expiresAt, now),
      ),
    );
  return rows.map((r) => r.caricaId);
}

/**
 * Returns all 7 current cariche with creature/owner info.
 */
export async function getAllActiveCariche(): Promise<Array<{
  caricaId: string;
  creatureId: string;
  userId: string;
  metricValue: number;
  creatureName: string;
  ownerName: string;
  awardedAt: string;
  expiresAt: string;
}>> {
  const now = new Date();
  const rows = await db
    .select({
      caricaId: cariche.caricaId,
      creatureId: cariche.creatureId,
      userId: cariche.userId,
      metricValue: cariche.metricValue,
      creatureName: creatures.name,
      ownerName: users.displayName,
      awardedAt: cariche.awardedAt,
      expiresAt: cariche.expiresAt,
    })
    .from(cariche)
    .innerJoin(creatures, eq(cariche.creatureId, creatures.id))
    .innerJoin(users, eq(cariche.userId, users.id))
    .where(gte(cariche.expiresAt, now));

  return rows.map((r) => ({
    caricaId: r.caricaId,
    creatureId: r.creatureId,
    userId: r.userId,
    metricValue: r.metricValue,
    creatureName: r.creatureName,
    ownerName: r.ownerName,
    awardedAt: r.awardedAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
  }));
}
