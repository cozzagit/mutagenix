import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  clanWars,
  clanWarMatches,
  clanMemberships,
  creatures,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { id: warId } = await context.params;

  // Get the war
  const [war] = await db.select().from(clanWars).where(eq(clanWars.id, warId));
  if (!war) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Guerra non trovata' } },
      { status: 404 },
    );
  }

  if (war.status !== 'pending') {
    return NextResponse.json(
      { error: { code: 'WRONG_STATUS', message: 'La guerra non è in attesa di accettazione' } },
      { status: 400 },
    );
  }

  // Verify caller is boss of defender clan
  const [callerMembership] = await db
    .select()
    .from(clanMemberships)
    .where(
      and(
        eq(clanMemberships.userId, session.userId),
        eq(clanMemberships.clanId, war.defenderClanId),
        eq(clanMemberships.role, 'boss'),
      ),
    );

  if (!callerMembership) {
    return NextResponse.json(
      { error: { code: 'NOT_BOSS', message: 'Solo il Boss del clan difensore può accettare' } },
      { status: 403 },
    );
  }

  // Build defender roster
  const defenderMembers = await db
    .select({ creatureId: clanMemberships.creatureId })
    .from(clanMemberships)
    .innerJoin(creatures, eq(creatures.id, clanMemberships.creatureId))
    .where(
      and(
        eq(clanMemberships.clanId, war.defenderClanId),
        eq(creatures.isDead, false),
        eq(creatures.isArchived, false),
      ),
    );

  const defenderRoster = defenderMembers.map((m) => m.creatureId);
  const challengerRoster = (war.challengerRoster as string[]) ?? [];

  // Determine number of matches based on format
  const formatToMatches: Record<string, number> = { bo3: 3, bo5: 5, bo7: 7 };
  const totalMatches = formatToMatches[war.format] ?? 5;

  // Generate match pairings (by index, cycling through rosters)
  const matchPairs: Array<{ creature1Id: string; creature2Id: string }> = [];
  for (let i = 0; i < totalMatches; i++) {
    const c1 = challengerRoster[i % challengerRoster.length];
    const c2 = defenderRoster[i % defenderRoster.length];
    if (c1 && c2) {
      matchPairs.push({ creature1Id: c1, creature2Id: c2 });
    }
  }

  if (matchPairs.length === 0) {
    return NextResponse.json(
      { error: { code: 'NO_CREATURES', message: 'Non ci sono abbastanza creature per i match' } },
      { status: 400 },
    );
  }

  // Create matches
  await db.insert(clanWarMatches).values(
    matchPairs.map((pair, index) => ({
      clanWarId: warId,
      matchIndex: index,
      creature1Id: pair.creature1Id,
      creature2Id: pair.creature2Id,
      status: 'pending' as const,
    })),
  );

  // Update war status
  await db
    .update(clanWars)
    .set({
      status: 'in_progress',
      defenderRoster,
      startedAt: new Date(),
    })
    .where(eq(clanWars.id, warId));

  return NextResponse.json({
    data: {
      id: warId,
      status: 'in_progress',
      totalMatches: matchPairs.length,
    },
  });
}
