import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures } from '@/lib/db/schema';
import { creatureRankings } from '@/lib/db/schema/creature-rankings';
import { eq, and } from 'drizzle-orm';
import { selectBestCreatures, type RotationCandidate } from '@/lib/game-engine/squad-auto-rotate';
import { loadWellnessInput } from '@/lib/game-engine/wellness-loader';
import { calculateWellness } from '@/lib/game-engine/wellness';

// ---------------------------------------------------------------------------
// POST — Run auto-rotation and return suggested lineup
// ---------------------------------------------------------------------------

export async function POST() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  // Fetch all living, non-archived creatures for this user
  const userCreatures = await db
    .select()
    .from(creatures)
    .where(
      and(
        eq(creatures.userId, session.userId),
        eq(creatures.isDead, false),
        eq(creatures.isArchived, false),
      ),
    );

  if (userCreatures.length === 0) {
    return NextResponse.json(
      { error: { code: 'NO_CREATURES', message: 'Non hai creature disponibili per la rotazione.' } },
      { status: 404 },
    );
  }

  // Build rotation candidates with stats + wellness
  const candidates: RotationCandidate[] = await Promise.all(
    userCreatures.map(async (c) => {
      const tv = c.traitValues as Record<string, number>;
      const wellnessInput = await loadWellnessInput(c.id);
      const wellness = calculateWellness(wellnessInput);

      return {
        creatureId: c.id,
        attackPower: tv.attackPower ?? 0,
        defense: tv.defense ?? 0,
        speed: tv.speed ?? 0,
        stamina: tv.stamina ?? 0,
        hpPercent: 100, // full HP outside tournament
        isDead: c.isDead,
        isArchived: c.isArchived,
        wellness,
      };
    }),
  );

  const bestIds = selectBestCreatures(candidates, 3);

  // Return full creature data for the suggested lineup
  const suggested = bestIds.map((id) => {
    const c = userCreatures.find((cr) => cr.id === id)!;
    const tv = c.traitValues as Record<string, number>;
    const candidate = candidates.find((ca) => ca.creatureId === id)!;
    return {
      id: c.id,
      name: c.name,
      ageDays: c.ageDays,
      stats: {
        attackPower: tv.attackPower ?? 0,
        defense: tv.defense ?? 0,
        speed: tv.speed ?? 0,
        stamina: tv.stamina ?? 0,
        specialAttack: tv.specialAttack ?? 0,
      },
      wellness: candidate.wellness,
    };
  });

  return NextResponse.json({ data: { suggested } });
}
