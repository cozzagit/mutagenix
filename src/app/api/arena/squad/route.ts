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

  if (!squad) {
    return NextResponse.json({
      data: {
        squad: null,
        slots: { slot1: null, slot2: null, slot3: null },
        reserves: { reserve1: null, reserve2: null, reserve3: null },
        autoRotate: true,
      },
    });
  }

  // Gather all creature IDs from squad
  const slotIds = [
    squad.slot1Id,
    squad.slot2Id,
    squad.slot3Id,
    squad.reserve1Id,
    squad.reserve2Id,
    squad.reserve3Id,
  ].filter((id): id is string => id !== null);

  let creatureMap = new Map<
    string,
    {
      id: string;
      name: string;
      ageDays: number | null;
      traitValues: Record<string, number>;
      isDead: boolean;
      stability: number | null;
      wellness: { activity: number; hunger: number; boredom: number; fatigue: number; composite: number };
    }
  >();

  if (slotIds.length > 0) {
    const rows = await db
      .select()
      .from(creatures)
      .where(sql`${creatures.id} IN (${sql.join(slotIds.map((id) => sql`${id}`), sql`, `)})`);

    // Load wellness for each creature
    const wellnessResults = await Promise.all(
      rows.map(async (c) => {
        const wellnessInput = await loadWellnessInput(c.id);
        const wellness = calculateWellness(wellnessInput);
        return { creature: c, wellness };
      }),
    );

    for (const { creature: c, wellness } of wellnessResults) {
      const tv = c.traitValues as Record<string, number>;
      creatureMap.set(c.id, {
        id: c.id,
        name: c.name,
        ageDays: c.ageDays,
        traitValues: {
          attackPower: tv.attackPower ?? 0,
          defense: tv.defense ?? 0,
          speed: tv.speed ?? 0,
          stamina: tv.stamina ?? 0,
          specialAttack: tv.specialAttack ?? 0,
        },
        isDead: c.isDead,
        stability: c.stability,
        wellness,
      });
    }
  }

  const getSlot = (id: string | null) => (id ? creatureMap.get(id) ?? null : null);

  return NextResponse.json({
    data: {
      squadId: squad.id,
      slots: {
        slot1: getSlot(squad.slot1Id),
        slot2: getSlot(squad.slot2Id),
        slot3: getSlot(squad.slot3Id),
      },
      reserves: {
        reserve1: getSlot(squad.reserve1Id),
        reserve2: getSlot(squad.reserve2Id),
        reserve3: getSlot(squad.reserve3Id),
      },
      autoRotate: squad.autoRotate,
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

  // Collect all provided creature IDs
  const allIds = [
    body.slot1Id,
    body.slot2Id,
    body.slot3Id,
    body.reserve1Id,
    body.reserve2Id,
    body.reserve3Id,
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
    slot1Id: body.slot1Id ?? null,
    slot2Id: body.slot2Id ?? null,
    slot3Id: body.slot3Id ?? null,
    reserve1Id: body.reserve1Id ?? null,
    reserve2Id: body.reserve2Id ?? null,
    reserve3Id: body.reserve3Id ?? null,
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
