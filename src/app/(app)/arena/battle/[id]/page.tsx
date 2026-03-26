import { getRequiredSession } from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { battles, creatures } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect, notFound } from 'next/navigation';
import { BattleReplay, type BattleReplayData } from '@/components/arena/battle-replay';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import type { TraitValues, ElementLevels } from '@/types/game';

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

  // Must be a participant or a tournament battle (public)
  const isTournamentBattle = battle.battleType === 'tournament';
  if (
    !isTournamentBattle &&
    battle.challengerUserId !== session.userId &&
    battle.defenderUserId !== session.userId
  ) {
    notFound();
  }

  // Fetch creature data and recalculate visual params
  const [challengerRaw] = await db
    .select({
      name: creatures.name,
      traitValues: creatures.traitValues,
      elementLevels: creatures.elementLevels,
      foundingElements: creatures.foundingElements,
      growthElements: creatures.growthElements,
    })
    .from(creatures)
    .where(eq(creatures.id, battle.challengerCreatureId));

  const [defenderRaw] = await db
    .select({
      name: creatures.name,
      traitValues: creatures.traitValues,
      elementLevels: creatures.elementLevels,
      foundingElements: creatures.foundingElements,
      growthElements: creatures.growthElements,
    })
    .from(creatures)
    .where(eq(creatures.id, battle.defenderCreatureId));

  const challengerCreature = challengerRaw ? {
    name: challengerRaw.name,
    visualParams: mapTraitsToVisuals(challengerRaw.traitValues as TraitValues, challengerRaw.elementLevels as ElementLevels, [], challengerRaw.foundingElements ?? null, challengerRaw.growthElements ?? null) as unknown as Record<string, unknown>,
  } : null;

  const defenderCreature = defenderRaw ? {
    name: defenderRaw.name,
    visualParams: mapTraitsToVisuals(defenderRaw.traitValues as TraitValues, defenderRaw.elementLevels as ElementLevels, [], defenderRaw.foundingElements ?? null, defenderRaw.growthElements ?? null) as unknown as Record<string, unknown>,
  } : null;

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

  // If tournament battle, find the tournament ID for the "back" link
  let tournamentId: string | null = null;
  if (battle.tournamentMatchId) {
    const { tournamentMatches } = await import('@/lib/db/schema');
    const [tm] = await db.select({ tournamentId: tournamentMatches.tournamentId })
      .from(tournamentMatches).where(eq(tournamentMatches.id, battle.tournamentMatchId));
    tournamentId = tm?.tournamentId ?? null;
  }

  return <BattleReplay battle={battleData} tournamentId={tournamentId} />;
}
