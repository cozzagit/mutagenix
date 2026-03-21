import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { battles, creatures } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect, notFound } from 'next/navigation';
import { BattleReplay, type BattleReplayData } from '@/components/arena/battle-replay';

export const dynamic = 'force-dynamic';

export default async function BattleReplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    redirect('/login');
  }

  const { id } = await params;

  if (!id) {
    notFound();
  }

  const [battle] = await db
    .select()
    .from(battles)
    .where(eq(battles.id, id));

  if (!battle) {
    notFound();
  }

  // Must be a participant
  if (
    battle.challengerUserId !== session.userId &&
    battle.defenderUserId !== session.userId
  ) {
    notFound();
  }

  // Fetch creature data
  const [challengerCreature] = await db
    .select({
      name: creatures.name,
      visualParams: creatures.visualParams,
    })
    .from(creatures)
    .where(eq(creatures.id, battle.challengerCreatureId));

  const [defenderCreature] = await db
    .select({
      name: creatures.name,
      visualParams: creatures.visualParams,
    })
    .from(creatures)
    .where(eq(creatures.id, battle.defenderCreatureId));

  // Determine result from viewer's perspective
  const viewerIsChallenger = battle.challengerUserId === session.userId;
  const isDraw = battle.winnerCreatureId === null;
  const viewerCreatureId = viewerIsChallenger
    ? battle.challengerCreatureId
    : battle.defenderCreatureId;
  const viewerWon = !isDraw && battle.winnerCreatureId === viewerCreatureId;

  const result: 'victory' | 'defeat' | 'draw' = isDraw
    ? 'draw'
    : viewerWon
      ? 'victory'
      : 'defeat';

  const battleData: BattleReplayData = {
    id: battle.id,
    battleType: battle.battleType,
    result,
    winnerId: battle.winnerCreatureId,
    roundsPlayed: battle.roundsPlayed,
    challenger: {
      creatureId: battle.challengerCreatureId,
      name: challengerCreature?.name ?? 'Sconosciuto',
      visualParams: (challengerCreature?.visualParams ?? {}) as Record<string, unknown>,
      eloBefore: battle.challengerEloBefore,
      eloAfter: battle.challengerEloAfter,
      eloDelta: battle.challengerEloAfter - battle.challengerEloBefore,
      finalHpPercent: battle.challengerHpPercent,
    },
    defender: {
      creatureId: battle.defenderCreatureId,
      name: defenderCreature?.name ?? 'Sconosciuto',
      visualParams: (defenderCreature?.visualParams ?? {}) as Record<string, unknown>,
      eloBefore: battle.defenderEloBefore,
      eloAfter: battle.defenderEloAfter,
      eloDelta: battle.defenderEloAfter - battle.defenderEloBefore,
      finalHpPercent: battle.defenderHpPercent,
    },
    events: (battle.battleLog ?? []) as BattleReplayData['events'],
    createdAt: battle.createdAt.toISOString(),
  };

  return <BattleReplay battle={battleData} />;
}
