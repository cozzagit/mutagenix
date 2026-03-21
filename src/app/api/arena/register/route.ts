import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { creatures, creatureRankings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getRankTier } from '@/lib/game-engine/battle-engine';

export async function POST() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  // Get active creature
  const [creature] = await db
    .select()
    .from(creatures)
    .where(
      and(
        eq(creatures.userId, session.userId),
        eq(creatures.isArchived, false),
      ),
    );

  if (!creature) {
    return NextResponse.json(
      { error: { code: 'NO_CREATURE', message: 'Non hai una creatura attiva.' } },
      { status: 404 },
    );
  }

  if ((creature.ageDays ?? 0) < 40) {
    return NextResponse.json(
      { error: { code: 'NOT_WARRIOR', message: 'La tua creatura deve avere almeno 40 giorni per entrare nell\'arena.' } },
      { status: 422 },
    );
  }

  // Check if already registered (idempotent — return existing ranking)
  const [existingRanking] = await db
    .select()
    .from(creatureRankings)
    .where(eq(creatureRankings.creatureId, creature.id));

  if (existingRanking) {
    return NextResponse.json({
      data: {
        id: existingRanking.id,
        creatureId: existingRanking.creatureId,
        eloRating: existingRanking.eloRating,
        rankTier: existingRanking.rankTier,
        wins: existingRanking.wins,
        losses: existingRanking.losses,
        draws: existingRanking.draws,
        alreadyRegistered: true,
        message: 'La tua creatura è già registrata nell\'arena.',
      },
    });
  }

  const tier = getRankTier(creature.ageDays ?? 0);

  const [ranking] = await db
    .insert(creatureRankings)
    .values({
      creatureId: creature.id,
      userId: session.userId,
      eloRating: 1000,
      eloPeak: 1000,
      rankTier: tier,
    })
    .returning();

  return NextResponse.json({
    data: {
      id: ranking.id,
      creatureId: ranking.creatureId,
      eloRating: ranking.eloRating,
      rankTier: ranking.rankTier,
      wins: ranking.wins,
      losses: ranking.losses,
      draws: ranking.draws,
      alreadyRegistered: false,
      message: 'Registrazione completata! Il tuo guerriero è pronto per combattere.',
    },
  }, { status: 201 });
}
