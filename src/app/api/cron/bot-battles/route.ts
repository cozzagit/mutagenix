// ---------------------------------------------------------------------------
// Mutagenix – Bot Auto-Battle Cron Endpoint
// ---------------------------------------------------------------------------
// GET /api/cron/bot-battles?key=mutagenix-bot-secret-2026
//
// Identifies bot scientists, makes them fight random opponents, and injects
// their daily recipe. Bots follow the exact same rules as real players.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  users,
  creatures,
  creatureRankings,
  allocations,
  dailySnapshots,
  mutationLog,
} from '@/lib/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { getRankTier } from '@/lib/game-engine/battle-engine';
import { executeBattle } from '@/lib/game-engine/execute-battle';
import { finalizeIfExpired } from '@/lib/game-engine/auto-finalize';
import {
  processDailyMutation,
  type CreatureInput,
} from '@/lib/game-engine/mutation-engine';
import { TIME_CONFIG } from '@/lib/game-engine/time-config';
import { GAME_CONFIG } from '@/lib/game-engine/constants';
import type { RankTier } from '@/types/battle';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CRON_SECRET = 'mutagenix-bot-secret-2026';

const BOT_RECIPES: Record<string, Record<string, number>> = {
  'bot.velenos@mutagenix.io': { S: 12, Cl: 10, P: 10, Fe: 8, K: 5, Na: 5 },
  'bot.cerebrum@mutagenix.io': { K: 10, Na: 8, P: 12, O: 8, N: 5, Fe: 7 },
  'bot.ossidiana@mutagenix.io': { Ca: 12, Fe: 10, C: 8, S: 8, O: 7, N: 5 },
  'bot.lumina@mutagenix.io': { P: 12, O: 10, K: 10, Na: 8, N: 5, Fe: 5 },
  'bot.organix@mutagenix.io': { N: 8, O: 8, C: 7, Fe: 7, Ca: 5, K: 5, P: 5, S: 3, Na: 2 },
};

// Adjacent tier map (same as challenge route)
const ADJACENT_TIERS: Record<RankTier, RankTier[]> = {
  novice: ['novice', 'intermediate'],
  intermediate: ['novice', 'intermediate', 'veteran'],
  veteran: ['intermediate', 'veteran', 'legend'],
  legend: ['veteran', 'legend', 'immortal'],
  immortal: ['legend', 'immortal', 'divine'],
  divine: ['immortal', 'divine', 'legend'],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BattleResultSummary {
  challenger: string;
  defender: string;
  winner: string | null;
  eloChange: string;
}

interface InjectionSummary {
  bot: string;
  creature: string;
  newDay: number;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // --- Autenticazione via chiave segreta ---
  if (request.nextUrl.searchParams.get('key') !== CRON_SECRET) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Chiave non valida.' } },
      { status: 403 },
    );
  }

  const now = new Date();
  const injectOnly = request.nextUrl.searchParams.get('inject-only') === 'true';
  const log: string[] = [];
  const battleResults: BattleResultSummary[] = [];
  const injectionResults: InjectionSummary[] = [];

  log.push(`[BOT CRON] Avvio ciclo bot${injectOnly ? ' (solo iniezioni)' : ''} — ${now.toISOString()}`);

  // =========================================================================
  // 1. Trova tutti gli utenti bot (@mutagenix.io)
  // =========================================================================
  const bots = await db
    .select()
    .from(users)
    .where(sql`${users.email} LIKE '%@mutagenix.io'`);

  if (bots.length === 0) {
    log.push('[BOT CRON] Nessun bot trovato. Fine.');
    return NextResponse.json({
      data: {
        battlesPlayed: 0,
        injectionsPerformed: 0,
        results: [],
        injections: [],
        log,
      },
    });
  }

  log.push(`[BOT CRON] Trovati ${bots.length} bot: ${bots.map((b) => b.displayName).join(', ')}`);

  // =========================================================================
  // 2. Carica le creature attive dei bot
  // =========================================================================
  const botUserIds = bots.map((b) => b.id);
  const botCreatures = await db
    .select()
    .from(creatures)
    .where(
      and(
        inArray(creatures.userId, botUserIds),
        eq(creatures.isArchived, false),
      ),
    );

  if (botCreatures.length === 0) {
    log.push('[BOT CRON] Nessuna creatura bot attiva. Fine.');
    return NextResponse.json({
      data: {
        battlesPlayed: 0,
        injectionsPerformed: 0,
        results: [],
        injections: [],
        log,
      },
    });
  }

  // Map: botUserId -> creature
  const botCreatureMap = new Map<string, typeof botCreatures[0]>();
  for (const c of botCreatures) {
    botCreatureMap.set(c.userId, c);
  }

  // Map: botUserId -> user
  const botUserMap = new Map<string, typeof bots[0]>();
  for (const b of bots) {
    botUserMap.set(b.id, b);
  }

  // =========================================================================
  // 3. Carica ranking dei bot
  // =========================================================================
  const botCreatureIds = botCreatures.map((c) => c.id);
  const botRankings = await db
    .select()
    .from(creatureRankings)
    .where(inArray(creatureRankings.creatureId, botCreatureIds));

  const botRankingMap = new Map<string, typeof botRankings[0]>();
  for (const r of botRankings) {
    botRankingMap.set(r.creatureId, r);
  }

  // =========================================================================
  // 4. Carica tutte le creature registrate (potenziali avversari)
  // =========================================================================
  const allCreatures = await db
    .select()
    .from(creatures)
    .where(eq(creatures.isArchived, false));

  const allRankings = await db
    .select()
    .from(creatureRankings);

  const rankingMap = new Map<string, typeof allRankings[0]>();
  for (const r of allRankings) {
    rankingMap.set(r.creatureId, r);
  }

  // =========================================================================
  // 5. Per ogni bot, decidi se combatte e contro chi (skip if inject-only)
  // =========================================================================
  if (!injectOnly) {
  // Set per tracciare creature che hanno gia' combattuto in questo ciclo
  const foughtThisCycle = new Set<string>();

  for (const bot of bots) {
    const botCreature = botCreatureMap.get(bot.id);
    if (!botCreature) {
      log.push(`[BOT CRON] ${bot.displayName}: nessuna creatura attiva, salto.`);
      continue;
    }

    // --- 70% chance di combattere questo giro ---
    if (Math.random() > 0.70) {
      log.push(`[BOT CRON] ${bot.displayName}: ha deciso di non combattere questo giro.`);
      continue;
    }

    // --- Controlla fase guerriero (ageDays >= 40) ---
    if ((botCreature.ageDays ?? 0) < 40) {
      log.push(`[BOT CRON] ${bot.displayName}: creatura troppo giovane (giorno ${botCreature.ageDays}), non puo' combattere.`);
      continue;
    }

    // --- Controlla recovery ---
    const botRanking = botRankingMap.get(botCreature.id);
    if (botRanking?.recoveryUntil && botRanking.recoveryUntil > now) {
      const remainMin = Math.ceil((botRanking.recoveryUntil.getTime() - now.getTime()) / 60000);
      log.push(`[BOT CRON] ${bot.displayName}: in recupero per altri ${remainMin} minuti, salto.`);
      continue;
    }

    // --- Controlla limite giornaliero ---
    let battlesToday = botRanking?.battlesToday ?? 0;
    if (botRanking?.lastBattleAt) {
      const lastDate = new Date(botRanking.lastBattleAt);
      const isNewDay = lastDate.getUTCDate() !== now.getUTCDate() ||
                       lastDate.getUTCMonth() !== now.getUTCMonth() ||
                       lastDate.getUTCFullYear() !== now.getUTCFullYear();
      if (isNewDay) battlesToday = 0;
    }
    if (battlesToday >= 10) {
      log.push(`[BOT CRON] ${bot.displayName}: limite giornaliero raggiunto (${battlesToday}/10), salto.`);
      continue;
    }

    // --- Trova avversari eligibili ---
    const botTier = getRankTier(botCreature.ageDays ?? 0);
    const adjacentTiers = ADJACENT_TIERS[botTier];

    const eligibleOpponents = allCreatures.filter((c) => {
      // Non se stesso
      if (c.id === botCreature.id) return false;
      // Non gia' combattuto in questo ciclo
      if (foughtThisCycle.has(c.id)) return false;
      // Deve essere in fase guerriero
      if ((c.ageDays ?? 0) < 40) return false;
      // Tier adiacente
      const opponentTier = getRankTier(c.ageDays ?? 0);
      if (!adjacentTiers.includes(opponentTier)) return false;
      // Non in recovery
      const opponentRanking = rankingMap.get(c.id);
      if (opponentRanking?.recoveryUntil && opponentRanking.recoveryUntil > now) return false;
      return true;
    });

    if (eligibleOpponents.length === 0) {
      log.push(`[BOT CRON] ${bot.displayName}: nessun avversario eligibile trovato, salto.`);
      continue;
    }

    // --- Preferisci avversari umani (70% umano, 30% bot) ---
    const humanOpponents = eligibleOpponents.filter(
      (c) => !botUserIds.includes(c.userId),
    );
    const botOpponents = eligibleOpponents.filter(
      (c) => botUserIds.includes(c.userId),
    );

    let opponent: typeof allCreatures[0];
    if (humanOpponents.length > 0 && (botOpponents.length === 0 || Math.random() < 0.70)) {
      opponent = humanOpponents[Math.floor(Math.random() * humanOpponents.length)];
    } else if (botOpponents.length > 0) {
      opponent = botOpponents[Math.floor(Math.random() * botOpponents.length)];
    } else {
      opponent = eligibleOpponents[Math.floor(Math.random() * eligibleOpponents.length)];
    }

    // --- Esegui la battaglia ---
    log.push(`[BOT CRON] ${bot.displayName} (${botCreature.name}) sfida ${opponent.name}...`);

    try {
      const result = await executeBattle(
        botCreature,
        opponent,
        bot.id,
        opponent.userId,
      );

      foughtThisCycle.add(botCreature.id);
      foughtThisCycle.add(opponent.id);

      const winnerName = result.isDraw
        ? 'Pareggio'
        : result.winnerId === botCreature.id
          ? botCreature.name
          : opponent.name;

      battleResults.push({
        challenger: botCreature.name,
        defender: opponent.name,
        winner: result.isDraw ? null : winnerName,
        eloChange: `${result.challengerEloDelta >= 0 ? '+' : ''}${result.challengerEloDelta}/${result.defenderEloDelta >= 0 ? '+' : ''}${result.defenderEloDelta}`,
      });

      log.push(
        `[BOT CRON] Risultato: ${result.isDraw ? 'PAREGGIO' : `VITTORIA di ${winnerName}`} ` +
        `(${result.rounds} round, ELO: ${result.challengerElo}/${result.defenderElo})`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.push(`[BOT CRON] ERRORE nella battaglia di ${bot.displayName}: ${errMsg}`);
    }
  }
  } // end if (!injectOnly)

  // =========================================================================
  // 6. Iniezioni: ogni bot inietta la sua ricetta se possibile
  // =========================================================================
  for (const bot of bots) {
    const botCreature = botCreatureMap.get(bot.id);
    if (!botCreature) continue;

    const recipe = BOT_RECIPES[bot.email];
    if (!recipe) {
      log.push(`[BOT CRON] ${bot.displayName}: nessuna ricetta configurata, salto iniezione.`);
      continue;
    }

    // Random skip: 50% chance di iniettare (diversifica crescita tra i bot)
    if (Math.random() > 0.5) {
      continue; // skip silenziosamente
    }

    // Auto-finalize mutazioni scadute
    let creature = await finalizeIfExpired(botCreature);

    // Controlla: non iniettare se mutazione in corso
    if (creature.mutationEndsAt && creature.mutationEndsAt.getTime() > Date.now()) {
      const remainMin = Math.ceil((creature.mutationEndsAt.getTime() - Date.now()) / 60000);
      log.push(`[BOT CRON] ${bot.displayName}: mutazione in corso (${remainMin} min rimanenti), salto iniezione.`);
      continue;
    }

    // Controlla cooldown
    if (creature.updatedAt) {
      const timeSinceUpdate = Date.now() - creature.updatedAt.getTime();
      if (timeSinceUpdate < TIME_CONFIG.COOLDOWN_MS && (creature.ageDays ?? 0) > 0) {
        const remainSec = Math.ceil((TIME_CONFIG.COOLDOWN_MS - timeSinceUpdate) / 1000);
        log.push(`[BOT CRON] ${bot.displayName}: cooldown attivo (${remainSec}s), salto iniezione.`);
        continue;
      }
    }

    // Controlla se la creatura e' archiviata
    if (creature.isArchived) {
      log.push(`[BOT CRON] ${bot.displayName}: creatura archiviata, salto iniezione.`);
      continue;
    }

    // Calcola crediti massimi (tier bonus)
    const creatureTier = getRankTier(creature.ageDays ?? 0);
    const bonusCredits = creatureTier === 'divine'
      ? GAME_CONFIG.DIVINE_CREDIT_BONUS
      : creatureTier === 'immortal'
        ? GAME_CONFIG.IMMORTAL_CREDIT_BONUS
        : 0;
    const maxCredits = GAME_CONFIG.DAILY_CREDITS + bonusCredits;

    // Scala la ricetta se supera il massimo
    const totalRecipeCredits = Object.values(recipe).reduce((sum, v) => sum + v, 0);
    let scaledRecipe = { ...recipe };
    if (totalRecipeCredits > maxCredits) {
      const scale = maxCredits / totalRecipeCredits;
      scaledRecipe = {};
      for (const [el, val] of Object.entries(recipe)) {
        scaledRecipe[el] = Math.max(1, Math.round(val * scale));
      }
    }

    const newDay = (creature.ageDays ?? 0) + 1;
    const dayKey = String(newDay);

    try {
      // Salva allocazione
      await db.insert(allocations).values({
        creatureId: creature.id,
        day: dayKey,
        credits: scaledRecipe,
        totalCredits: Object.values(scaledRecipe).reduce((s, v) => s + v, 0),
      });

      // Esegui mutazione
      const creatureInput: CreatureInput = {
        id: creature.id,
        elementLevels: creature.elementLevels,
        traitValues: creature.traitValues,
        ageDays: creature.ageDays ?? 0,
        stability: creature.stability ?? 0.5,
        day: newDay,
        foundingElements: creature.foundingElements ?? null,
        growthElements: creature.growthElements ?? null,
      };

      const mutationResult = processDailyMutation(creatureInput, scaledRecipe);

      // Set target state per mutazione graduale
      const injNow = new Date();
      const mutationEndsAt = new Date(injNow.getTime() + TIME_CONFIG.getMutationDurationMs());

      // Phase memory update
      const phaseUpdate: Record<string, unknown> = {};
      if (newDay <= 15) {
        const existing = creature.foundingElements ?? {};
        const updated: Record<string, number> = { ...existing };
        for (const [el, val] of Object.entries(scaledRecipe)) {
          if (typeof val === 'number' && val > 0) {
            updated[el] = (updated[el] ?? 0) + val;
          }
        }
        phaseUpdate.foundingElements = updated;
      } else if (newDay <= 40) {
        const existing = creature.growthElements ?? {};
        const updated: Record<string, number> = { ...existing };
        for (const [el, val] of Object.entries(scaledRecipe)) {
          if (typeof val === 'number' && val > 0) {
            updated[el] = (updated[el] ?? 0) + val;
          }
        }
        phaseUpdate.growthElements = updated;
      }

      await db
        .update(creatures)
        .set({
          targetElementLevels: mutationResult.newElementLevels,
          targetTraitValues: mutationResult.newTraitValues,
          targetVisualParams: mutationResult.newVisualParams as unknown as Record<string, unknown>,
          stability: mutationResult.newStability,
          mutationStartedAt: injNow,
          mutationEndsAt,
          updatedAt: injNow,
          ...phaseUpdate,
        })
        .where(eq(creatures.id, creature.id));

      // Salva snapshot giornaliero
      await db.insert(dailySnapshots).values({
        creatureId: creature.id,
        day: dayKey,
        elementLevels: mutationResult.newElementLevels,
        traitValues: mutationResult.newTraitValues,
        visualParams: mutationResult.newVisualParams as unknown as Record<string, unknown>,
        stabilityScore: mutationResult.newStability,
        mutationsApplied: mutationResult.mutations.map((m) => ({
          traitId: m.traitId,
          delta: m.delta,
          trigger: m.triggerType,
        })),
      });

      // Salva mutation log
      if (mutationResult.mutations.length > 0) {
        const triggerTypeMap: Record<string, 'element' | 'synergy' | 'decay' | 'threshold' | 'noise'> = {
          growth: 'element',
          synergy: 'synergy',
          decay: 'decay',
          noise: 'noise',
        };

        await db.insert(mutationLog).values(
          mutationResult.mutations.map((m) => ({
            creatureId: creature.id,
            day: dayKey,
            traitId: m.traitId,
            oldValue: m.oldValue,
            newValue: m.newValue,
            delta: m.delta,
            triggerType: triggerTypeMap[m.triggerType] ?? 'element',
            triggerDetails: m.triggerDetails ?? null,
          })),
        );
      }

      injectionResults.push({
        bot: bot.displayName,
        creature: creature.name,
        newDay,
      });

      log.push(
        `[BOT CRON] ${bot.displayName}: iniezione completata! ` +
        `Giorno ${newDay}, ${mutationResult.mutations.length} mutazioni, ` +
        `stabilita' ${mutationResult.newStability.toFixed(2)}`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.push(`[BOT CRON] ERRORE nell'iniezione di ${bot.displayName}: ${errMsg}`);
    }
  }

  // =========================================================================
  // 7. Riepilogo finale
  // =========================================================================
  log.push(`[BOT CRON] Ciclo completato. Battaglie: ${battleResults.length}, Iniezioni: ${injectionResults.length}`);

  return NextResponse.json({
    data: {
      battlesPlayed: battleResults.length,
      injectionsPerformed: injectionResults.length,
      results: battleResults,
      injections: injectionResults,
      log,
    },
  });
}
