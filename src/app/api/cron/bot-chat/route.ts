// ---------------------------------------------------------------------------
// Mutagenix — Bot Chat Cron Endpoint
// ---------------------------------------------------------------------------
// GET /api/cron/bot-chat?key=mutagenix-bot-secret-2026
//
// Runs every 30 minutes. Makes bots post provocative messages and respond
// to mentions from the last 30 minutes.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, chatMessages, creatures } from '@/lib/db/schema';
import { sql, gte } from 'drizzle-orm';
import {
  generateBotProvocation,
  generateBotResponse,
  registerBotUserId,
  getBotPersonalityByUserId,
  shouldBotRespond,
} from '@/lib/game-engine/bot-chat';

const CRON_SECRET = 'mutagenix-bot-secret-2026';

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('key') !== CRON_SECRET) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Chiave non valida.' } },
      { status: 403 },
    );
  }

  const log: string[] = [];
  const now = new Date();
  log.push(`[BOT CHAT CRON] Avvio — ${now.toISOString()}`);

  // =========================================================================
  // 1. Find all bot users and register their personalities
  // =========================================================================
  const bots = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName })
    .from(users)
    .where(sql`${users.email} LIKE '%@mutagenix.io'`);

  if (bots.length === 0) {
    log.push('Nessun bot trovato.');
    return NextResponse.json({ data: { log } });
  }

  for (const bot of bots) {
    registerBotUserId(bot.email, bot.id);
  }

  // =========================================================================
  // 2. Find active human players (for targeting provocations)
  // =========================================================================
  const humanPlayers = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(sql`${users.email} NOT LIKE '%@mutagenix.io'`)
    .limit(20);
  const playerNames = humanPlayers.map((p) => p.displayName);

  // =========================================================================
  // 3. Phase 1 — Provocations (40% chance one bot posts)
  // =========================================================================
  if (Math.random() < 0.4 && bots.length > 0) {
    const randomBot = bots[Math.floor(Math.random() * bots.length)];
    const personality = getBotPersonalityByUserId(randomBot.id);

    if (personality) {
      const message = generateBotProvocation(personality, playerNames);
      await db.insert(chatMessages).values({
        userId: randomBot.id,
        content: message,
        mentions: [],
      });
      log.push(`[PROVOCAZIONE] ${randomBot.displayName}: "${message}"`);
    }
  } else {
    log.push('[PROVOCAZIONE] Nessuna provocazione questo ciclo.');
  }

  // =========================================================================
  // 4. Phase 2 — Respond to mentions from last 30 minutes
  // =========================================================================
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

  const recentMessages = await db
    .select({
      id: chatMessages.id,
      userId: chatMessages.userId,
      content: chatMessages.content,
      mentions: chatMessages.mentions,
      displayName: users.displayName,
      email: users.email,
    })
    .from(chatMessages)
    .innerJoin(users, sql`${chatMessages.userId} = ${users.id}`)
    .where(gte(chatMessages.createdAt, thirtyMinAgo));

  // Filter to human messages only
  const humanMessages = recentMessages.filter(
    (m) => !m.email?.endsWith('@mutagenix.io'),
  );

  // Get bot creature names for matching
  const botCreatures = await db
    .select({ id: creatures.id, name: creatures.name, userId: creatures.userId })
    .from(creatures)
    .where(sql`${creatures.userId} IN (${sql.join(bots.map((b) => sql`${b.id}`), sql`, `)})`);

  let responsesPosted = 0;

  for (const msg of humanMessages) {
    const contentLower = msg.content.toLowerCase();

    for (const bot of bots) {
      const personality = getBotPersonalityByUserId(bot.id);
      if (!personality) continue;

      // Check if this bot or its creatures are mentioned
      const botNameLower = bot.displayName.toLowerCase();
      const botCreatureNames = botCreatures
        .filter((c) => c.userId === bot.id)
        .map((c) => c.name.toLowerCase());

      const isMentioned =
        contentLower.includes(botNameLower) ||
        botCreatureNames.some((name) => contentLower.includes(name)) ||
        (Array.isArray(msg.mentions) && (msg.mentions as { id: string }[]).some((m) => m.id === bot.id));

      if (!shouldBotRespond(personality, msg.content, isMentioned)) continue;

      const mentionedCreature = botCreatureNames.find((name) => contentLower.includes(name));
      const response = generateBotResponse(
        personality,
        msg.displayName,
        mentionedCreature,
      );

      // Insert with a small delay
      const delayMs = 5_000 + Math.random() * 15_000;
      const responseTime = new Date(now.getTime() + delayMs);

      await db.insert(chatMessages).values({
        userId: bot.id,
        content: response,
        mentions: [],
        createdAt: responseTime,
      });

      log.push(`[RISPOSTA] ${bot.displayName} → ${msg.displayName}: "${response}"`);
      responsesPosted++;
    }
  }

  log.push(`[BOT CHAT CRON] Fine — ${responsesPosted} risposte postate.`);

  return NextResponse.json({
    data: {
      provocations: log.filter((l) => l.includes('[PROVOCAZIONE]')).length,
      responses: responsesPosted,
      log,
    },
  });
}
