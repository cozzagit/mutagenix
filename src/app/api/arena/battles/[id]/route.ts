import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { battles, creatures } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'ID della battaglia obbligatorio.' } },
      { status: 400 },
    );
  }

  const [battle] = await db
    .select()
    .from(battles)
    .where(eq(battles.id, id));

  if (!battle) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Battaglia non trovata.' } },
      { status: 404 },
    );
  }

  // Must be a participant
  if (
    battle.challengerUserId !== session.userId &&
    battle.defenderUserId !== session.userId
  ) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Non sei un partecipante di questa battaglia.' } },
      { status: 403 },
    );
  }

  // Fetch creature names and visual params
  const [challengerCreature] = await db
    .select({ name: creatures.name, visualParams: creatures.visualParams })
    .from(creatures)
    .where(eq(creatures.id, battle.challengerCreatureId));

  const [defenderCreature] = await db
    .select({ name: creatures.name, visualParams: creatures.visualParams })
    .from(creatures)
    .where(eq(creatures.id, battle.defenderCreatureId));

  const isDraw = battle.winnerCreatureId === null;
  const viewerIsChallenger = battle.challengerUserId === session.userId;
  const viewerWon = !isDraw && (
    (viewerIsChallenger && battle.winnerCreatureId === battle.challengerCreatureId) ||
    (!viewerIsChallenger && battle.winnerCreatureId === battle.defenderCreatureId)
  );

  return NextResponse.json({
    data: {
      id: battle.id,
      battleType: battle.battleType,
      result: isDraw ? 'draw' : viewerWon ? 'victory' : 'defeat',
      winnerId: battle.winnerCreatureId,
      roundsPlayed: battle.roundsPlayed,
      challenger: {
        creatureId: battle.challengerCreatureId,
        name: challengerCreature?.name ?? 'Sconosciuto',
        visualParams: challengerCreature?.visualParams ?? {},
        eloBefore: battle.challengerEloBefore,
        eloAfter: battle.challengerEloAfter,
        eloDelta: battle.challengerEloAfter - battle.challengerEloBefore,
        finalHpPercent: battle.challengerHpPercent,
      },
      defender: {
        creatureId: battle.defenderCreatureId,
        name: defenderCreature?.name ?? 'Sconosciuto',
        visualParams: defenderCreature?.visualParams ?? {},
        eloBefore: battle.defenderEloBefore,
        eloAfter: battle.defenderEloAfter,
        eloDelta: battle.defenderEloAfter - battle.defenderEloBefore,
        finalHpPercent: battle.defenderHpPercent,
      },
      events: battle.battleLog, // Full event array for replay
      createdAt: battle.createdAt.toISOString(),
    },
  });
}
