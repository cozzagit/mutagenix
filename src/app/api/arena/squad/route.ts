import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { squads, creatures } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { loadWellnessInput } from '@/lib/game-engine/wellness-loader';
import { calculateWellness } from '@/lib/game-engine/wellness';

// ---------------------------------------------------------------------------
// GET — Return user's current squad
// ---------------------------------------------------------------------------

export async function GET() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const [squad] = await db
    .select()
    .from(squads)
    .where(eq(squads.userId, session.userId));

  // Helper to build a SquadCreature from a DB row + wellness
  function toSquadCreature(
    c: typeof allUserCreatures[number],
    wellness: { activity: number; hunger: number; boredom: number; fatigue: number; composite: number },
  ) {
    const tv = c.traitValues as Record<string, number>;
    return {
      id: c.id,
      name: c.name,
      ageDays: c.ageDays,
      attackPower: tv.attackPower ?? 0,
      defense: tv.defense ?? 0,
      speed: tv.speed ?? 0,
      visualParams: c.visualParams ?? {},
      wellness,
    };
  }

  // Load all user's alive, non-archived creatures
  const allUserCreatures = await db
    .select()
    .from(creatures)
    .where(
      and(
        eq(creatures.userId, session.userId),
        eq(creatures.isDead, false),
        eq(creatures.isArchived, false),
      ),
    );

  // Load wellness for all user creatures
  const wellnessResults = await Promise.all(
    allUserCreatures.map(async (c) => {
      const wellnessInput = await loadWellnessInput(c.id);
      const wellness = calculateWellness(wellnessInput);
      return { creature: c, wellness };
    }),
  );

  const creatureMap = new Map(
    wellnessResults.map(({ creature, wellness }) => [
      creature.id,
      { creature, wellness },
    ]),
  );

  if (!squad) {
    // No squad yet — all creatures are available
    const available = wellnessResults.map(({ creature, wellness }) =>
      toSquadCreature(creature, wellness),
    );

    return NextResponse.json({
      data: {
        starters: [null, null, null],
        reserves: [null, null, null],
        autoRotate: true,
        available,
      },
    });
  }

  // Build starters and reserves arrays
  const starterIds = [squad.slot1Id, squad.slot2Id, squad.slot3Id];
  const reserveIds = [squad.reserve1Id, squad.reserve2Id, squad.reserve3Id];
  const assignedIds = new Set(
    [...starterIds, ...reserveIds].filter((id): id is string => id !== null),
  );

  const getSlot = (id: string | null) => {
    if (!id) return null;
    const entry = creatureMap.get(id);
    if (!entry) return null;
    return toSquadCreature(entry.creature, entry.wellness);
  };

  const starters = starterIds.map(getSlot);
  const reserves = reserveIds.map(getSlot);

  // Available = all user's alive creatures NOT already assigned to a slot
  const available = wellnessResults
    .filter(({ creature }) => !assignedIds.has(creature.id))
    .map(({ creature, wellness }) => toSquadCreature(creature, wellness));

  return NextResponse.json({
    data: {
      squadId: squad.id,
      starters,
      reserves,
      autoRotate: squad.autoRotate,
      available,
    },
  });
}

// ---------------------------------------------------------------------------
// PUT — Update squad composition
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  let body: {
    // New array format from component
    starters?: (string | null)[];
    reserves?: (string | null)[];
    // Legacy named-slot format
    slot1Id?: string | null;
    slot2Id?: string | null;
    slot3Id?: string | null;
    reserve1Id?: string | null;
    reserve2Id?: string | null;
    reserve3Id?: string | null;
    autoRotate?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Corpo della richiesta non valido.' } },
      { status: 400 },
    );
  }

  // Support both array format (from component) and named-slot format
  const slot1Id = body.starters?.[0] ?? body.slot1Id ?? null;
  const slot2Id = body.starters?.[1] ?? body.slot2Id ?? null;
  const slot3Id = body.starters?.[2] ?? body.slot3Id ?? null;
  const reserve1Id = body.reserves?.[0] ?? body.reserve1Id ?? null;
  const reserve2Id = body.reserves?.[1] ?? body.reserve2Id ?? null;
  const reserve3Id = body.reserves?.[2] ?? body.reserve3Id ?? null;

  // Collect all provided creature IDs
  const allIds = [
    slot1Id,
    slot2Id,
    slot3Id,
    reserve1Id,
    reserve2Id,
    reserve3Id,
  ].filter((id): id is string => id != null);

  // Check for duplicates
  const uniqueIds = new Set(allIds);
  if (uniqueIds.size !== allIds.length) {
    return NextResponse.json(
      { error: { code: 'DUPLICATE_CREATURE', message: 'Non puoi inserire la stessa creatura in più slot.' } },
      { status: 422 },
    );
  }

  // Validate all creatures belong to user, are alive, and not archived
  if (allIds.length > 0) {
    const ownedCreatures = await db
      .select({ id: creatures.id, isDead: creatures.isDead, isArchived: creatures.isArchived })
      .from(creatures)
      .where(
        and(
          eq(creatures.userId, session.userId),
          sql`${creatures.id} IN (${sql.join(allIds.map((id) => sql`${id}`), sql`, `)})`,
        ),
      );

    const ownedMap = new Map(ownedCreatures.map((c) => [c.id, c]));

    for (const id of allIds) {
      const c = ownedMap.get(id);
      if (!c) {
        return NextResponse.json(
          { error: { code: 'CREATURE_NOT_OWNED', message: `La creatura ${id} non ti appartiene.` } },
          { status: 403 },
        );
      }
      if (c.isDead) {
        return NextResponse.json(
          { error: { code: 'CREATURE_DEAD', message: `La creatura ${id} è morta e non può combattere.` } },
          { status: 422 },
        );
      }
      if (c.isArchived) {
        return NextResponse.json(
          { error: { code: 'CREATURE_ARCHIVED', message: `La creatura ${id} è archiviata.` } },
          { status: 422 },
        );
      }
    }
  }

  const now = new Date();
  const values = {
    userId: session.userId,
    slot1Id,
    slot2Id,
    slot3Id,
    reserve1Id,
    reserve2Id,
    reserve3Id,
    autoRotate: body.autoRotate ?? true,
    updatedAt: now,
  };

  // Upsert: insert or update on userId conflict
  const [squad] = await db
    .insert(squads)
    .values({ ...values, createdAt: now })
    .onConflictDoUpdate({
      target: squads.userId,
      set: values,
    })
    .returning();

  return NextResponse.json({ data: { squadId: squad.id, ...values } });
}
