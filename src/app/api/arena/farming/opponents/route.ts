import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  creatures,
  creatureRankings,
  squads,
} from '@/lib/db/schema';
import { users } from '@/lib/db/schema/users';
import { eq, and, ne, desc, sql } from 'drizzle-orm';
import type { BattleFormat } from '@/lib/game-engine/squad-battle-engine';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import type { TraitValues, ElementLevels } from '@/types/game';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roundToNearest10(value: number): number {
  return Math.round(value / 10) * 10;
}

async function getFarmingStats(userId: string): Promise<{
  wins: number;
  losses: number;
  farmingAxp: number;
  battlesToday: number;
  dailyLimit: number;
}> {
  // Aggregate farming stats across all user's creature rankings
  const rows = await db
    .select({
      farmingWins: creatureRankings.farmingWins,
      farmingLosses: creatureRankings.farmingLosses,
      farmingAxp: creatureRankings.farmingAxp,
    })
    .from(creatureRankings)
    .where(eq(creatureRankings.userId, userId));

  let wins = 0;
  let losses = 0;
  let farmingAxp = 0;
  for (const r of rows) {
    wins += r.farmingWins;
    losses += r.farmingLosses;
    farmingAxp += r.farmingAxp;
  }

  // Count farming battles today from the battles table
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sql`battles`)
    .where(
      sql`challenger_user_id = ${userId} AND battle_type = 'farming' AND created_at >= ${today.toISOString()}`,
    );

  return {
    wins,
    losses,
    farmingAxp,
    battlesToday: countRow?.count ?? 0,
    dailyLimit: 20,
  };
}

// ---------------------------------------------------------------------------
// GET — List available farming opponents
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get('format') ?? '1v1') as BattleFormat;

  if (!['1v1', '2v2', '3v3'].includes(format)) {
    return NextResponse.json(
      { error: { code: 'INVALID_FORMAT', message: 'Formato non valido. Usa 1v1, 2v2 o 3v3.' } },
      { status: 400 },
    );
  }

  // Detect bot users
  const allUsersForBotCheck = await db.select({ id: users.id, email: users.email }).from(users);
  const botUserIdSet = new Set<string>();
  for (const u of allUsersForBotCheck) {
    if (u.email?.includes('@mutagenix.io')) botUserIdSet.add(u.id);
  }

  if (format === '1v1') {
    // 1v1: show individual creatures (warrior phase, alive, not archived, not own)
    const opponents = await db
      .select({
        creature: creatures,
        ownerName: users.displayName,
        ranking: creatureRankings,
      })
      .from(creatures)
      .innerJoin(users, eq(users.id, creatures.userId))
      .leftJoin(creatureRankings, eq(creatureRankings.creatureId, creatures.id))
      .where(
        and(
          ne(creatures.userId, session.userId),
          eq(creatures.isArchived, false),
          eq(creatures.isDead, false),
          sql`${creatures.ageDays} >= 40`,
        ),
      )
      .orderBy(desc(creatureRankings.eloRating))
      .limit(20);

    const result = opponents.map((o) => {
      const tv = o.creature.traitValues as Record<string, number>;
      return {
        creatureId: o.creature.id,
        userId: o.creature.userId,
        creatureName: o.creature.name,
        userName: o.ownerName,
        ageDays: o.creature.ageDays,
        eloRating: o.ranking?.eloRating ?? 1000,
        isBot: botUserIdSet.has(o.creature.userId),
        attackPower: roundToNearest10(tv.attackPower ?? 0),
        defense: roundToNearest10(tv.defense ?? 0),
        speed: roundToNearest10(tv.speed ?? 0),
        visualParams: mapTraitsToVisuals(
          o.creature.traitValues as unknown as TraitValues,
          o.creature.elementLevels as unknown as ElementLevels,
          [], o.creature.foundingElements, o.creature.growthElements,
        ) as unknown as Record<string, unknown>,
      };
    });

    // Fetch farming stats for this user
    const farmingStats = await getFarmingStats(session.userId);

    return NextResponse.json({
      data: {
        opponents: result,
        stats: farmingStats,
      },
    });
  }

  // 2v2 / 3v3: show players who have squads with enough filled slots
  const requiredSlots = format === '2v2' ? 2 : 3;

  const opponentSquads = await db
    .select({
      squad: squads,
      ownerName: users.displayName,
      ownerId: users.id,
    })
    .from(squads)
    .innerJoin(users, eq(users.id, squads.userId))
    .where(ne(squads.userId, session.userId))
    .limit(50);

  // Filter squads that have enough living creatures
  const validOpponents: Array<{
    userId: string;
    ownerName: string;
    squadId: string;
    creatures: Array<{
      id: string;
      name: string;
      ageDays: number | null;
      attackPower: number;
      defense: number;
      speed: number;
      stamina: number;
      visualParams: Record<string, unknown>;
    }>;
  }> = [];

  for (const o of opponentSquads) {
    const slotIds = [o.squad.slot1Id, o.squad.slot2Id, o.squad.slot3Id]
      .filter((id): id is string => id !== null)
      .slice(0, requiredSlots);

    if (slotIds.length < requiredSlots) continue;

    // Fetch creatures for these slots
    const squadCreatures = await db
      .select()
      .from(creatures)
      .where(
        and(
          sql`${creatures.id} IN (${sql.join(slotIds.map((id) => sql`${id}`), sql`, `)})`,
          eq(creatures.isDead, false),
          eq(creatures.isArchived, false),
        ),
      );

    if (squadCreatures.length < requiredSlots) continue;

    validOpponents.push({
      userId: o.ownerId,
      ownerName: o.ownerName,
      squadId: o.squad.id,
      creatures: squadCreatures.map((c) => {
        const tv = c.traitValues as Record<string, number>;
        return {
          id: c.id,
          name: c.name,
          ageDays: c.ageDays,
          attackPower: roundToNearest10(tv.attackPower ?? 0),
          defense: roundToNearest10(tv.defense ?? 0),
          speed: roundToNearest10(tv.speed ?? 0),
          stamina: roundToNearest10(tv.stamina ?? 0),
          visualParams: mapTraitsToVisuals(
            c.traitValues as unknown as TraitValues,
            c.elementLevels as unknown as ElementLevels,
            [], c.foundingElements, c.growthElements,
          ) as unknown as Record<string, unknown>,
        };
      }),
    });

    if (validOpponents.length >= 20) break;
  }

  // Map to the format expected by the component
  const result = validOpponents.map((o) => ({
    userId: o.userId,
    userName: o.ownerName,
    squadPreview: o.creatures.map((c) => ({
      name: c.name,
      visualParams: c.visualParams ?? {},
    })),
  }));

  const farmingStats = await getFarmingStats(session.userId);

  return NextResponse.json({
    data: {
      opponents: result,
      stats: farmingStats,
    },
  });
}
