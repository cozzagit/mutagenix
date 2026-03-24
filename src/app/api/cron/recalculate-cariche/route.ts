// ---------------------------------------------------------------------------
// Mutagenix – Cariche Recalculation Cron
// ---------------------------------------------------------------------------
// GET /api/cron/recalculate-cariche?key=mutagenix-bot-secret-2026
//
// Recalculates all 7 Cariche del Laboratorio based on current game state.
// Runs weekly (or on-demand). Archives old cariche to history table.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  creatures,
  creatureRankings,
  battles,
  breedingRecords,
  cariche,
  caricaHistory,
} from '@/lib/db/schema';
import { eq, and, gte, or, sql } from 'drizzle-orm';
import { calculateCariche, type CaricaInput, type CaricaCreature } from '@/lib/game-engine/cariche-engine';
import { calculateWellness } from '@/lib/game-engine/wellness';
import { loadWellnessInput } from '@/lib/game-engine/wellness-loader';
import { calculateSynergies } from '@/lib/game-engine/synergy-system';
import type { ElementLevels } from '@/types/game';

const CRON_SECRET = 'mutagenix-bot-secret-2026';

export async function GET(request: NextRequest) {
  // --- Auth ---
  if (request.nextUrl.searchParams.get('key') !== CRON_SECRET) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Chiave non valida.' } },
      { status: 403 },
    );
  }

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const log: string[] = [];

  log.push(`[CARICHE CRON] Avvio ricalcolo — ${now.toISOString()}`);

  // =========================================================================
  // 1. Fetch all alive non-archived creatures
  // =========================================================================
  const allCreatures = await db
    .select()
    .from(creatures)
    .where(
      and(
        eq(creatures.isArchived, false),
        eq(creatures.isDead, false),
      ),
    );

  log.push(`[CARICHE CRON] Creature vive: ${allCreatures.length}`);

  if (allCreatures.length === 0) {
    return NextResponse.json({
      data: { caricheAssigned: 0, log },
    });
  }

  // =========================================================================
  // 2. Fetch all rankings
  // =========================================================================
  const allRankings = await db.select().from(creatureRankings);
  const rankingMap = new Map(allRankings.map((r) => [r.creatureId, r]));

  // =========================================================================
  // 3. Calculate weekly ELO delta from battles (last 7 days)
  // =========================================================================
  const weeklyBattles = await db
    .select()
    .from(battles)
    .where(gte(battles.createdAt, oneWeekAgo));

  const weeklyEloDelta = new Map<string, number>();
  const weeklyBattleCount = new Map<string, number>();

  for (const b of weeklyBattles) {
    // Challenger
    const cDelta = b.challengerEloAfter - b.challengerEloBefore;
    weeklyEloDelta.set(b.challengerCreatureId, (weeklyEloDelta.get(b.challengerCreatureId) ?? 0) + cDelta);
    weeklyBattleCount.set(b.challengerCreatureId, (weeklyBattleCount.get(b.challengerCreatureId) ?? 0) + 1);

    // Defender
    const dDelta = b.defenderEloAfter - b.defenderEloBefore;
    weeklyEloDelta.set(b.defenderCreatureId, (weeklyEloDelta.get(b.defenderCreatureId) ?? 0) + dDelta);
    weeklyBattleCount.set(b.defenderCreatureId, (weeklyBattleCount.get(b.defenderCreatureId) ?? 0) + 1);
  }

  log.push(`[CARICHE CRON] Battaglie questa settimana: ${weeklyBattles.length}`);

  // =========================================================================
  // 4. Calculate wellness for each creature
  // =========================================================================
  const wellnessScores = new Map<string, number>();

  for (const c of allCreatures) {
    const ranking = rankingMap.get(c.id);
    const wellnessInput = await loadWellnessInput(c.id, ranking ? {
      lastBattleAt: ranking.lastBattleAt,
      battlesToday: ranking.battlesToday,
    } : null);
    const wellness = calculateWellness(wellnessInput);
    wellnessScores.set(c.id, wellness.composite);
  }

  // =========================================================================
  // 5. Calculate synergies for each creature
  // =========================================================================
  const synergyCount = new Map<string, number>();

  for (const c of allCreatures) {
    const elLevels = c.elementLevels as unknown as ElementLevels;
    const result = calculateSynergies(elLevels, c.id, c.ageDays ?? 0);
    synergyCount.set(c.id, result.activeSynergies.length);
  }

  // =========================================================================
  // 6. Count offspring per creature from breeding_records
  // =========================================================================
  const offspringCount = new Map<string, { userId: string; count: number }>();

  // Count living offspring: creatures that have this creature as parent
  const breedingRows = await db
    .select({
      parentAId: breedingRecords.parentAId,
      parentBId: breedingRecords.parentBId,
      playerAId: breedingRecords.playerAId,
      playerBId: breedingRecords.playerBId,
      offspringAId: breedingRecords.offspringAId,
      offspringBId: breedingRecords.offspringBId,
    })
    .from(breedingRecords)
    .where(eq(breedingRecords.status, 'completed'));

  // Build a set of alive creature IDs for quick lookup
  const aliveIds = new Set(allCreatures.map((c) => c.id));

  // Count living offspring per user
  const userLivingOffspring = new Map<string, number>();
  for (const br of breedingRows) {
    // Offspring A belongs to playerA
    if (br.offspringAId && aliveIds.has(br.offspringAId)) {
      userLivingOffspring.set(br.playerAId, (userLivingOffspring.get(br.playerAId) ?? 0) + 1);
    }
    // Offspring B belongs to playerB
    if (br.offspringBId && aliveIds.has(br.offspringBId)) {
      userLivingOffspring.set(br.playerBId, (userLivingOffspring.get(br.playerBId) ?? 0) + 1);
    }
  }

  // For each creature, map its user's offspring count
  for (const c of allCreatures) {
    const count = userLivingOffspring.get(c.userId) ?? 0;
    if (count > 0) {
      offspringCount.set(c.id, { userId: c.userId, count });
    }
  }

  // =========================================================================
  // 7. Build input and calculate cariche
  // =========================================================================
  const caricaCreatures: CaricaCreature[] = allCreatures.map((c) => ({
    id: c.id,
    userId: c.userId,
    ageDays: c.ageDays ?? 0,
    stability: c.stability ?? 0.5,
    traitValues: c.traitValues as Record<string, number>,
    elementLevels: c.elementLevels as Record<string, number>,
    isArchived: c.isArchived,
    isDead: c.isDead ?? false,
  }));

  const caricaRankings = allRankings.map((r) => ({
    creatureId: r.creatureId,
    eloRating: r.eloRating,
    wins: r.wins,
    winStreak: r.winStreak,
    axp: r.axp,
  }));

  const input: CaricaInput = {
    creatures: caricaCreatures,
    rankings: caricaRankings,
    weeklyEloDelta,
    weeklyBattleCount,
    wellnessScores,
    synergyCount,
    offspringCount,
  };

  const newCariche = calculateCariche(input);

  log.push(`[CARICHE CRON] Cariche calcolate: ${newCariche.length}`);

  // =========================================================================
  // 8. Transaction: archive current -> delete -> insert new
  // =========================================================================
  const currentCariche = await db.select().from(cariche);

  await db.transaction(async (tx) => {
    // Archive current to history
    if (currentCariche.length > 0) {
      await tx.insert(caricaHistory).values(
        currentCariche.map((c) => ({
          caricaId: c.caricaId,
          creatureId: c.creatureId,
          userId: c.userId,
          metricValue: c.metricValue,
          weekStart: c.awardedAt,
          weekEnd: now,
        })),
      );
    }

    // Delete all current cariche
    if (currentCariche.length > 0) {
      await tx.delete(cariche).where(
        sql`1=1`, // delete all rows
      );
    }

    // Insert new winners
    if (newCariche.length > 0) {
      await tx.insert(cariche).values(
        newCariche.map((c) => ({
          caricaId: c.caricaId,
          creatureId: c.creatureId,
          userId: c.userId,
          metricValue: c.metricValue,
          awardedAt: now,
          expiresAt: oneWeekFromNow,
        })),
      );
    }
  });

  log.push(`[CARICHE CRON] Archiviate ${currentCariche.length} cariche precedenti, inserite ${newCariche.length} nuove.`);

  // =========================================================================
  // 9. Summary
  // =========================================================================
  const summary = newCariche.map((c) => {
    const creature = allCreatures.find((cr) => cr.id === c.creatureId);
    return {
      caricaId: c.caricaId,
      creatureName: creature?.name ?? '???',
      metricValue: c.metricValue,
    };
  });

  log.push(`[CARICHE CRON] Completato.`);

  return NextResponse.json({
    data: {
      caricheAssigned: newCariche.length,
      summary,
      log,
    },
  });
}
