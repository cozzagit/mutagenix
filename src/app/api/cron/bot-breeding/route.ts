// ---------------------------------------------------------------------------
// Mutagenix – Bot Auto-Breeding Cron Endpoint
// ---------------------------------------------------------------------------
// GET /api/cron/bot-breeding?key=mutagenix-bot-secret-2026
//
// Runs every 6 hours. Handles:
// 1. Bot-to-bot breeding (50% chance, 48h cooldown, max 3 children, gen < 3)
// 2. Auto-accept pending breeding requests where target is a bot
// 3. One random bot proposes breeding to a random human per cycle
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  users,
  creatures,
  breedingRequests,
  breedingRecords,
  creatureLineage,
  clans,
  clanMemberships,
} from '@/lib/db/schema';
import { eq, and, ne, sql, inArray, notInArray } from 'drizzle-orm';
import {
  calculateOffspring,
  type BreedingParent,
} from '@/lib/game-engine/genetics-engine';
import { mapTraitsToVisuals } from '@/lib/game-engine/visual-mapper';
import { BREEDING_CONFIG } from '@/lib/game-engine/breeding-config';
import type { ElementLevels, TraitValues } from '@/types/game';
import type {
  ElementLevels as SchemaElementLevels,
  TraitValues as SchemaTraitValues,
} from '@/lib/db/schema/creatures';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CRON_SECRET = 'mutagenix-bot-secret-2026';
const MAX_CREATURES_PER_BOT = 13;
const MIN_AGE_TO_BREED = 40;
const BREEDING_COOLDOWN_MS = 48 * 60 * 60 * 1000; // 48 hours
const BREED_CHANCE = 0.50; // 50% random chance per eligible bot per cycle

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BreedingSummary {
  parentA: string;
  parentB: string;
  offspringA: string;
  offspringB: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a creature is eligible for breeding */
async function getChildCount(creatureId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creatureLineage)
    .where(
      and(
        eq(creatureLineage.parentId, creatureId),
        eq(creatureLineage.parentRole, 'primary'),
      ),
    );
  return result?.count ?? 0;
}

/** Count active creatures for a user */
async function countActiveCreatures(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creatures)
    .where(
      and(
        eq(creatures.userId, userId),
        eq(creatures.isArchived, false),
        eq(creatures.isDead, false),
      ),
    );
  return result?.count ?? 0;
}

/** Execute the breeding between two creatures and create offspring */
async function executeBreeding(
  parentACreature: typeof creatures.$inferSelect,
  parentBCreature: typeof creatures.$inferSelect,
  parentAUserId: string,
  parentBUserId: string,
): Promise<{ offspringA: typeof creatures.$inferSelect; offspringB: typeof creatures.$inferSelect; record: typeof breedingRecords.$inferSelect }> {
  const seedString = `bot-breeding:${parentACreature.id}:${parentBCreature.id}:${Date.now()}`;

  const parentA: BreedingParent = {
    id: parentACreature.id,
    elementLevels: parentACreature.elementLevels as unknown as Record<string, number>,
    traitValues: parentACreature.traitValues as unknown as Record<string, number>,
    stability: parentACreature.stability ?? 0.5,
    foundingElements: parentACreature.foundingElements ?? null,
    growthElements: parentACreature.growthElements ?? null,
    ageDays: parentACreature.ageDays ?? 0,
    familyGeneration: parentACreature.familyGeneration,
  };

  const parentB: BreedingParent = {
    id: parentBCreature.id,
    elementLevels: parentBCreature.elementLevels as unknown as Record<string, number>,
    traitValues: parentBCreature.traitValues as unknown as Record<string, number>,
    stability: parentBCreature.stability ?? 0.5,
    foundingElements: parentBCreature.foundingElements ?? null,
    growthElements: parentBCreature.growthElements ?? null,
    ageDays: parentBCreature.ageDays ?? 0,
    familyGeneration: parentBCreature.familyGeneration,
  };

  const breedingResult = calculateOffspring(parentA, parentB, seedString);

  // Create offspring visual params
  const offspringAVisual = mapTraitsToVisuals(
    breedingResult.offspringA.traitValues as unknown as TraitValues,
    breedingResult.offspringA.elementLevels as unknown as ElementLevels,
    [],
    breedingResult.offspringA.foundingElements,
    breedingResult.offspringA.growthElements,
  );

  const offspringBVisual = mapTraitsToVisuals(
    breedingResult.offspringB.traitValues as unknown as TraitValues,
    breedingResult.offspringB.elementLevels as unknown as ElementLevels,
    [],
    breedingResult.offspringB.foundingElements,
    breedingResult.offspringB.growthElements,
  );

  // Insert offspring A (goes to parentA's owner)
  const [offspringA] = await db
    .insert(creatures)
    .values({
      userId: parentAUserId,
      name: `Figlio di ${parentACreature.name}`,
      generation: breedingResult.offspringA.familyGeneration,
      ageDays: 0,
      elementLevels: breedingResult.offspringA.elementLevels as unknown as SchemaElementLevels,
      traitValues: breedingResult.offspringA.traitValues as unknown as SchemaTraitValues,
      stability: breedingResult.offspringA.stability,
      foundingElements: breedingResult.offspringA.foundingElements,
      growthElements: null,
      visualParams: offspringAVisual as unknown as Record<string, unknown>,
      isFounder: false,
      isArchived: false,
      isDead: false,
      familyGeneration: breedingResult.offspringA.familyGeneration,
      parentACreatureId: parentACreature.id,
      parentBCreatureId: parentBCreature.id,
    })
    .returning();

  // Insert offspring B (goes to parentB's owner)
  const [offspringB] = await db
    .insert(creatures)
    .values({
      userId: parentBUserId,
      name: `Figlio di ${parentBCreature.name}`,
      generation: breedingResult.offspringB.familyGeneration,
      ageDays: 0,
      elementLevels: breedingResult.offspringB.elementLevels as unknown as SchemaElementLevels,
      traitValues: breedingResult.offspringB.traitValues as unknown as SchemaTraitValues,
      stability: breedingResult.offspringB.stability,
      foundingElements: breedingResult.offspringB.foundingElements,
      growthElements: null,
      visualParams: offspringBVisual as unknown as Record<string, unknown>,
      isFounder: false,
      isArchived: false,
      isDead: false,
      familyGeneration: breedingResult.offspringB.familyGeneration,
      parentACreatureId: parentBCreature.id,
      parentBCreatureId: parentACreature.id,
    })
    .returning();

  // Create breeding record
  const [breedingRecord] = await db
    .insert(breedingRecords)
    .values({
      parentAId: parentACreature.id,
      parentBId: parentBCreature.id,
      playerAId: parentAUserId,
      playerBId: parentBUserId,
      offspringAId: offspringA.id,
      offspringBId: offspringB.id,
      energyCost: 0, // Bots don't pay energy
      status: 'completed',
      geneticsSeed: seedString,
    })
    .returning();

  // Create 4 creature lineage entries
  await db.insert(creatureLineage).values([
    {
      childId: offspringA.id,
      parentId: parentACreature.id,
      parentRole: 'primary',
      breedingId: breedingRecord.id,
    },
    {
      childId: offspringA.id,
      parentId: parentBCreature.id,
      parentRole: 'partner',
      breedingId: breedingRecord.id,
    },
    {
      childId: offspringB.id,
      parentId: parentBCreature.id,
      parentRole: 'primary',
      breedingId: breedingRecord.id,
    },
    {
      childId: offspringB.id,
      parentId: parentACreature.id,
      parentRole: 'partner',
      breedingId: breedingRecord.id,
    },
  ]);

  // Update user maxCreatures if needed
  for (const userId of [parentAUserId, parentBUserId]) {
    const [newCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(creatures)
      .where(
        and(
          eq(creatures.userId, userId),
          eq(creatures.isArchived, false),
          eq(creatures.isDead, false),
        ),
      );

    await db
      .update(users)
      .set({
        maxCreatures: sql`GREATEST(${users.maxCreatures}, ${newCount?.count ?? 1})`,
      })
      .where(eq(users.id, userId));
  }

  return { offspringA, offspringB, record: breedingRecord };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // --- Auth ---
  if (request.nextUrl.searchParams.get('key') !== CRON_SECRET) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Chiave non valida.' } },
      { status: 403 },
    );
  }

  const now = new Date();
  const log: string[] = [];
  const breedingResults: BreedingSummary[] = [];
  let autoAccepted = 0;
  let proposalsSent = 0;

  log.push(`[BOT BREEDING] Avvio ciclo — ${now.toISOString()}`);

  // =========================================================================
  // 1. Find all bot users
  // =========================================================================
  const bots = await db
    .select()
    .from(users)
    .where(sql`${users.email} LIKE '%@mutagenix.io'`);

  if (bots.length === 0) {
    log.push('[BOT BREEDING] Nessun bot trovato. Fine.');
    return NextResponse.json({
      data: { breedings: 0, autoAccepted: 0, proposals: 0, results: [], log },
    });
  }

  const botUserIds = bots.map((b) => b.id);
  const botUserIdSet = new Set(botUserIds);
  const botUserMap = new Map(bots.map((b) => [b.id, b]));

  log.push(`[BOT BREEDING] Trovati ${bots.length} bot: ${bots.map((b) => b.displayName).join(', ')}`);

  // =========================================================================
  // 2. Load all bot creatures (alive, not archived)
  // =========================================================================
  const allBotCreatures = await db
    .select()
    .from(creatures)
    .where(
      and(
        inArray(creatures.userId, botUserIds),
        eq(creatures.isArchived, false),
        eq(creatures.isDead, false),
      ),
    );

  // =========================================================================
  // 3. Get last breeding time for each creature (from breeding_records)
  // =========================================================================
  const allBotCreatureIds = allBotCreatures.map((c) => c.id);
  const recentBreedings = allBotCreatureIds.length > 0
    ? await db
        .select({
          parentId: breedingRecords.parentAId,
          createdAt: breedingRecords.createdAt,
        })
        .from(breedingRecords)
        .where(
          sql`(${breedingRecords.parentAId} IN (${sql.join(allBotCreatureIds.map(id => sql`${id}`), sql`, `)})
            OR ${breedingRecords.parentBId} IN (${sql.join(allBotCreatureIds.map(id => sql`${id}`), sql`, `)}))
            AND ${breedingRecords.createdAt} > ${new Date(now.getTime() - BREEDING_COOLDOWN_MS).toISOString()}`
        )
    : [];

  // Also get parentB entries
  const recentBreedingsB = allBotCreatureIds.length > 0
    ? await db
        .select({
          parentId: breedingRecords.parentBId,
          createdAt: breedingRecords.createdAt,
        })
        .from(breedingRecords)
        .where(
          sql`${breedingRecords.parentBId} IN (${sql.join(allBotCreatureIds.map(id => sql`${id}`), sql`, `)})
            AND ${breedingRecords.createdAt} > ${new Date(now.getTime() - BREEDING_COOLDOWN_MS).toISOString()}`
        )
    : [];

  // Build set of creatures that bred recently (within 48h)
  const recentlyBredCreatures = new Set<string>();
  for (const r of recentBreedings) {
    if (allBotCreatureIds.includes(r.parentId)) {
      recentlyBredCreatures.add(r.parentId);
    }
  }
  for (const r of recentBreedingsB) {
    recentlyBredCreatures.add(r.parentId);
  }

  // =========================================================================
  // 4. Bot-to-bot breeding
  // =========================================================================
  log.push('[BOT BREEDING] === Fase 1: Riproduzione bot-to-bot ===');

  // Track which creatures breed this cycle (max once per cycle)
  const bredThisCycle = new Set<string>();

  for (const bot of bots) {
    // Count active creatures for this bot
    const botActiveCount = allBotCreatures.filter((c) => c.userId === bot.id).length;
    if (botActiveCount >= MAX_CREATURES_PER_BOT) {
      log.push(`[BOT BREEDING] ${bot.displayName}: limite creature raggiunto (${botActiveCount}/${MAX_CREATURES_PER_BOT}), salto.`);
      continue;
    }

    // Find eligible creatures for this bot
    const botEligible = allBotCreatures.filter((c) => {
      if (c.userId !== bot.id) return false;
      if (bredThisCycle.has(c.id)) return false;
      if ((c.ageDays ?? 0) < MIN_AGE_TO_BREED) return false;
      if (c.familyGeneration >= BREEDING_CONFIG.MAX_GENERATIONS) return false;
      if (recentlyBredCreatures.has(c.id)) return false;
      return true;
    });

    if (botEligible.length === 0) {
      log.push(`[BOT BREEDING] ${bot.displayName}: nessuna creatura eligible, salto.`);
      continue;
    }

    // 50% random chance
    if (Math.random() > BREED_CHANCE) {
      log.push(`[BOT BREEDING] ${bot.displayName}: skip casuale (50%).`);
      continue;
    }

    // Pick a random eligible creature
    const parentA = botEligible[Math.floor(Math.random() * botEligible.length)];

    // Check children count
    const parentAChildren = await getChildCount(parentA.id);
    if (parentAChildren >= BREEDING_CONFIG.MAX_CHILDREN_PER_CREATURE) {
      log.push(`[BOT BREEDING] ${bot.displayName}: ${parentA.name} ha gia' ${parentAChildren} figli, salto.`);
      continue;
    }

    // Find a partner from ANOTHER bot's creatures
    const partnerCandidates = allBotCreatures.filter((c) => {
      if (c.userId === bot.id) return false; // Must be from another bot
      if (bredThisCycle.has(c.id)) return false;
      if ((c.ageDays ?? 0) < MIN_AGE_TO_BREED) return false;
      if (c.familyGeneration >= BREEDING_CONFIG.MAX_GENERATIONS) return false;
      if (recentlyBredCreatures.has(c.id)) return false;
      return true;
    });

    if (partnerCandidates.length === 0) {
      log.push(`[BOT BREEDING] ${bot.displayName}: nessun partner bot disponibile, salto.`);
      continue;
    }

    // Check partner's children count (filter out those with max children)
    let partner: typeof allBotCreatures[0] | null = null;
    // Shuffle candidates to pick randomly
    const shuffled = [...partnerCandidates].sort(() => Math.random() - 0.5);
    for (const candidate of shuffled) {
      const childCount = await getChildCount(candidate.id);
      if (childCount < BREEDING_CONFIG.MAX_CHILDREN_PER_CREATURE) {
        // Also check partner's owner active creature count
        const partnerOwnerCount = allBotCreatures.filter((c) => c.userId === candidate.userId).length;
        if (partnerOwnerCount < MAX_CREATURES_PER_BOT) {
          partner = candidate;
          break;
        }
      }
    }

    if (!partner) {
      log.push(`[BOT BREEDING] ${bot.displayName}: nessun partner eligibile (figli/creature max), salto.`);
      continue;
    }

    // Execute breeding
    try {
      const result = await executeBreeding(parentA, partner, bot.id, partner.userId);

      bredThisCycle.add(parentA.id);
      bredThisCycle.add(partner.id);

      const partnerBot = botUserMap.get(partner.userId);
      breedingResults.push({
        parentA: `${parentA.name} (${bot.displayName})`,
        parentB: `${partner.name} (${partnerBot?.displayName ?? '?'})`,
        offspringA: result.offspringA.name,
        offspringB: result.offspringB.name,
      });

      log.push(
        `[BOT BREEDING] Riproduzione: ${parentA.name} x ${partner.name} → ` +
        `${result.offspringA.name} + ${result.offspringB.name}`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.push(`[BOT BREEDING] ERRORE nella riproduzione di ${parentA.name}: ${errMsg}`);
    }
  }

  // =========================================================================
  // 5. Auto-accept pending breeding requests where target is a bot
  // =========================================================================
  log.push('[BOT BREEDING] === Fase 2: Auto-accept richieste pendenti ===');

  const pendingRequests = await db
    .select()
    .from(breedingRequests)
    .where(
      and(
        eq(breedingRequests.status, 'pending'),
        inArray(breedingRequests.targetId, botUserIds),
      ),
    );

  for (const req of pendingRequests) {
    // Check if expired
    if (req.expiresAt < now) {
      await db
        .update(breedingRequests)
        .set({ status: 'expired' })
        .where(eq(breedingRequests.id, req.id));
      log.push(`[BOT BREEDING] Richiesta ${req.id.slice(0, 8)} scaduta, aggiornata.`);
      continue;
    }

    // Fetch both creatures
    const [requesterCreature] = await db
      .select()
      .from(creatures)
      .where(eq(creatures.id, req.requesterCreatureId));

    const [targetCreature] = await db
      .select()
      .from(creatures)
      .where(eq(creatures.id, req.targetCreatureId));

    if (!requesterCreature || !targetCreature) {
      log.push(`[BOT BREEDING] Richiesta ${req.id.slice(0, 8)}: creature non trovate, salto.`);
      continue;
    }

    // Validate creatures still eligible
    if (requesterCreature.isArchived || requesterCreature.isDead ||
        targetCreature.isArchived || targetCreature.isDead) {
      log.push(`[BOT BREEDING] Richiesta ${req.id.slice(0, 8)}: creature non piu' disponibili, salto.`);
      continue;
    }

    if (requesterCreature.familyGeneration >= BREEDING_CONFIG.MAX_GENERATIONS ||
        targetCreature.familyGeneration >= BREEDING_CONFIG.MAX_GENERATIONS) {
      log.push(`[BOT BREEDING] Richiesta ${req.id.slice(0, 8)}: generazione massima, salto.`);
      continue;
    }

    // Check children count
    const reqChildren = await getChildCount(requesterCreature.id);
    const tgtChildren = await getChildCount(targetCreature.id);
    if (reqChildren >= BREEDING_CONFIG.MAX_CHILDREN_PER_CREATURE ||
        tgtChildren >= BREEDING_CONFIG.MAX_CHILDREN_PER_CREATURE) {
      log.push(`[BOT BREEDING] Richiesta ${req.id.slice(0, 8)}: figli massimi raggiunti, salto.`);
      continue;
    }

    // Check energy for requester (human) - bots don't need energy
    const [requesterUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.requesterId));

    if (!requesterUser || requesterUser.energy < req.energyCost) {
      log.push(`[BOT BREEDING] Richiesta ${req.id.slice(0, 8)}: richiedente senza energia sufficiente, salto.`);
      continue;
    }

    try {
      // Deduct energy from human requester only
      await db
        .update(users)
        .set({ energy: requesterUser.energy - req.energyCost, updatedAt: now })
        .where(eq(users.id, req.requesterId));

      // Execute breeding
      const result = await executeBreeding(
        requesterCreature,
        targetCreature,
        req.requesterId,
        req.targetId,
      );

      // Update request status
      await db
        .update(breedingRequests)
        .set({ status: 'accepted', respondedAt: now })
        .where(eq(breedingRequests.id, req.id));

      autoAccepted++;
      log.push(
        `[BOT BREEDING] Auto-accettata richiesta ${req.id.slice(0, 8)}: ` +
        `${requesterCreature.name} x ${targetCreature.name} → ` +
        `${result.offspringA.name} + ${result.offspringB.name}`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.push(`[BOT BREEDING] ERRORE nell'auto-accept ${req.id.slice(0, 8)}: ${errMsg}`);
    }
  }

  // =========================================================================
  // 6. One random bot proposes breeding to a random human (max 1 per cycle)
  // =========================================================================
  log.push('[BOT BREEDING] === Fase 3: Proposta bot → umano ===');

  // Find eligible bot creatures for proposing
  const botProposers = allBotCreatures.filter((c) => {
    if (bredThisCycle.has(c.id)) return false;
    if ((c.ageDays ?? 0) < MIN_AGE_TO_BREED) return false;
    if (c.familyGeneration >= BREEDING_CONFIG.MAX_GENERATIONS) return false;
    if (recentlyBredCreatures.has(c.id)) return false;
    return true;
  });

  if (botProposers.length > 0) {
    // Pick a random bot creature
    const proposer = botProposers[Math.floor(Math.random() * botProposers.length)];
    const proposerBot = botUserMap.get(proposer.userId);

    // Find eligible human creatures
    const humanCreatures = await db
      .select()
      .from(creatures)
      .where(
        and(
          eq(creatures.isArchived, false),
          eq(creatures.isDead, false),
          sql`${creatures.ageDays} >= ${MIN_AGE_TO_BREED}`,
          sql`${creatures.familyGeneration} < ${BREEDING_CONFIG.MAX_GENERATIONS}`,
        ),
      );

    // Filter to human-owned creatures only
    const eligibleHumans = humanCreatures.filter((c) => !botUserIdSet.has(c.userId));

    if (eligibleHumans.length > 0) {
      // Pick a random human creature
      const target = eligibleHumans[Math.floor(Math.random() * eligibleHumans.length)];

      // Check children count for target
      const targetChildren = await getChildCount(target.id);
      const proposerChildren = await getChildCount(proposer.id);

      if (targetChildren < BREEDING_CONFIG.MAX_CHILDREN_PER_CREATURE &&
          proposerChildren < BREEDING_CONFIG.MAX_CHILDREN_PER_CREATURE) {
        // Check no existing pending request for this pair
        const [existingReq] = await db
          .select()
          .from(breedingRequests)
          .where(
            and(
              eq(breedingRequests.requesterCreatureId, proposer.id),
              eq(breedingRequests.targetCreatureId, target.id),
              eq(breedingRequests.status, 'pending'),
            ),
          );

        if (!existingReq) {
          try {
            // Calculate energy cost based on generation
            const maxGen = Math.max(proposer.familyGeneration, target.familyGeneration);
            const energyCost = Math.floor(
              BREEDING_CONFIG.BASE_ENERGY_COST *
              Math.pow(BREEDING_CONFIG.GENERATION_COST_MULTIPLIER, maxGen - 1),
            );

            const expiresAt = new Date(now.getTime() + BREEDING_CONFIG.REQUEST_EXPIRY_HOURS * 60 * 60 * 1000);

            await db.insert(breedingRequests).values({
              requesterId: proposer.userId,
              targetId: target.userId,
              requesterCreatureId: proposer.id,
              targetCreatureId: target.id,
              status: 'pending',
              message: `${proposerBot?.displayName ?? 'Bot'} propone un accoppiamento tra ${proposer.name} e ${target.name}.`,
              energyCost,
              expiresAt,
            });

            proposalsSent++;
            log.push(
              `[BOT BREEDING] Proposta inviata: ${proposer.name} (${proposerBot?.displayName}) → ${target.name}`,
            );
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            log.push(`[BOT BREEDING] ERRORE nella proposta: ${errMsg}`);
          }
        } else {
          log.push('[BOT BREEDING] Proposta gia\' esistente per questa coppia, salto.');
        }
      } else {
        log.push('[BOT BREEDING] Creature con troppi figli per proposta, salto.');
      }
    } else {
      log.push('[BOT BREEDING] Nessuna creatura umana eligibile per proposta.');
    }
  } else {
    log.push('[BOT BREEDING] Nessun bot eligible per proporre.');
  }

  // =========================================================================
  // 7. Phase 4: Clan recruitment — bot clans recruit clanless bot creatures
  // =========================================================================
  log.push('[BOT BREEDING] === Fase 4: Reclutamento clan bot ===');

  let clanRecruits = 0;

  // Find all clans owned by bot users
  const botClans = await db
    .select()
    .from(clans)
    .where(
      and(
        inArray(clans.ownerId, botUserIds),
        ne(clans.status, 'disbanded'),
      ),
    );

  if (botClans.length === 0) {
    log.push('[BOT BREEDING] Nessun clan bot trovato.');
  } else {
    log.push(`[BOT BREEDING] Trovati ${botClans.length} clan bot.`);

    // Get all creature IDs already in a clan
    const allMemberships = await db
      .select({ creatureId: clanMemberships.creatureId })
      .from(clanMemberships);
    const creaturesInClan = new Set(allMemberships.map((m) => m.creatureId));

    for (const clan of botClans) {
      if (clanRecruits >= 2) {
        log.push(`[BOT BREEDING] Limite reclutamenti raggiunto (${clanRecruits}/2), stop.`);
        break;
      }

      // Check max members
      if (clan.totalMembers >= clan.maxMembers) {
        log.push(`[BOT BREEDING] Clan "${clan.name}": pieno (${clan.totalMembers}/${clan.maxMembers}), salto.`);
        continue;
      }

      // Find bot creatures NOT in any clan, alive, not archived, ageDays >= 40
      const eligible = allBotCreatures.filter((c) => {
        if (creaturesInClan.has(c.id)) return false;
        if (c.isDead) return false;
        if (c.isArchived) return false;
        if ((c.ageDays ?? 0) < 40) return false;
        return true;
      });

      if (eligible.length === 0) {
        log.push(`[BOT BREEDING] Clan "${clan.name}": nessuna creatura bot eligible per reclutamento.`);
        continue;
      }

      for (const creature of eligible) {
        if (clanRecruits >= 2) break;
        if (clan.totalMembers + clanRecruits >= clan.maxMembers) break;

        // 30% random chance per eligible creature per cycle
        if (Math.random() > 0.30) continue;

        try {
          // Add creature to clan as 'soldato'
          await db.insert(clanMemberships).values({
            clanId: clan.id,
            creatureId: creature.id,
            userId: creature.userId,
            role: 'soldato',
          });

          // Update clan totalMembers and status
          const newTotal = clan.totalMembers + clanRecruits + 1;
          await db
            .update(clans)
            .set({
              totalMembers: sql`${clans.totalMembers} + 1`,
              status: newTotal >= 3 ? 'active' : clan.status,
              updatedAt: now,
            })
            .where(eq(clans.id, clan.id));

          creaturesInClan.add(creature.id);
          clanRecruits++;

          log.push(
            `[BOT BREEDING] Reclutato "${creature.name}" nel clan "${clan.name}" come soldato.`,
          );
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.push(`[BOT BREEDING] ERRORE reclutamento "${creature.name}": ${errMsg}`);
        }
      }
    }
  }

  log.push(`[BOT BREEDING] Reclutamenti clan completati: ${clanRecruits}`);

  // =========================================================================
  // 8. Riepilogo finale
  // =========================================================================
  log.push(
    `[BOT BREEDING] Ciclo completato. Riproduzioni: ${breedingResults.length}, ` +
    `Auto-accept: ${autoAccepted}, Proposte: ${proposalsSent}, ` +
    `Reclutamenti clan: ${clanRecruits}`,
  );

  return NextResponse.json({
    data: {
      breedings: breedingResults.length,
      autoAccepted,
      proposals: proposalsSent,
      clanRecruits,
      results: breedingResults,
      log,
    },
  });
}
