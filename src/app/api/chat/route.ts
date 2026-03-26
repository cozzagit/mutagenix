import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { chatMessages, users } from '@/lib/db/schema';
import { eq, gt, desc, sql } from 'drizzle-orm';
import type { ChatMention } from '@/lib/db/schema';
import { generateBotResponse, getBotPersonalityByUserId, shouldBotRespond } from '@/lib/game-engine/bot-chat';

// ---------------------------------------------------------------------------
// GET /api/chat — Fetch messages
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  const { searchParams } = request.nextUrl;
  const after = searchParams.get('after');
  const limitParam = parseInt(searchParams.get('limit') ?? '50', 10);
  const limit = Math.min(Math.max(1, limitParam), 100);

  try {
    const conditions = after
      ? gt(chatMessages.createdAt, new Date(after))
      : undefined;

    const rows = await db
      .select({
        id: chatMessages.id,
        userId: chatMessages.userId,
        content: chatMessages.content,
        mentions: chatMessages.mentions,
        isSystem: chatMessages.isSystem,
        createdAt: chatMessages.createdAt,
        displayName: users.displayName,
        email: users.email,
      })
      .from(chatMessages)
      .innerJoin(users, eq(chatMessages.userId, users.id))
      .where(conditions)
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    // Reverse so oldest first for display
    const messages = rows.reverse().map((r) => ({
      id: r.id,
      userId: r.userId,
      content: r.content,
      mentions: r.mentions,
      isSystem: r.isSystem,
      createdAt: r.createdAt?.toISOString(),
      displayName: r.displayName,
      isBot: r.email?.endsWith('@mutagenix.io') ?? false,
    }));

    void session; // used for auth gating

    return NextResponse.json({
      data: { messages, serverTime: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[Chat GET] Error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Errore nel caricamento dei messaggi' } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/chat — Send message
// ---------------------------------------------------------------------------

// In-memory rate limiter: userId -> last send timestamp
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 5_000;

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  // Rate limit check
  const lastSend = rateLimitMap.get(session.userId) ?? 0;
  if (Date.now() - lastSend < RATE_LIMIT_MS) {
    const waitSec = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastSend)) / 1000);
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: `Aspetta ${waitSec}s prima di inviare un altro messaggio` } },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'JSON non valido' } },
      { status: 400 },
    );
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Body non valido' } },
      { status: 400 },
    );
  }

  const { content, mentions } = body as { content: unknown; mentions: unknown };

  if (typeof content !== 'string' || content.trim().length < 1 || content.trim().length > 200) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Il messaggio deve essere tra 1 e 200 caratteri' } },
      { status: 400 },
    );
  }

  const validMentions: ChatMention[] = Array.isArray(mentions)
    ? mentions.filter(
        (m: unknown) =>
          typeof m === 'object' &&
          m !== null &&
          typeof (m as ChatMention).type === 'string' &&
          typeof (m as ChatMention).id === 'string' &&
          typeof (m as ChatMention).name === 'string' &&
          typeof (m as ChatMention).startIndex === 'number' &&
          typeof (m as ChatMention).endIndex === 'number',
      )
    : [];

  try {
    const [inserted] = await db
      .insert(chatMessages)
      .values({
        userId: session.userId,
        content: content.trim(),
        mentions: validMentions,
      })
      .returning();

    rateLimitMap.set(session.userId, Date.now());

    // --- Bot auto-response (delayed) ---
    // Check if any bot was mentioned — schedule a delayed response
    triggerBotResponses(session.name, content.trim(), validMentions).catch(() => {});

    return NextResponse.json({
      data: {
        id: inserted.id,
        content: inserted.content,
        mentions: inserted.mentions,
        createdAt: inserted.createdAt?.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[Chat POST] Error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Errore nell\'invio del messaggio' } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Trigger bot responses when mentioned
// ---------------------------------------------------------------------------

async function triggerBotResponses(senderName: string, content: string, mentions: ChatMention[]) {
  // Find all bot users
  const bots = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName })
    .from(users)
    .where(sql`${users.email} LIKE '%@mutagenix.io'`);

  for (const bot of bots) {
    const personality = getBotPersonalityByUserId(bot.id);
    if (!personality) continue;

    // Check if this bot or its creature was mentioned
    const isMentioned = mentions.some(
      (m) => m.id === bot.id || (m.type === 'creature' && content.toLowerCase().includes(personality.displayName.toLowerCase())),
    ) || content.toLowerCase().includes(personality.displayName.toLowerCase());

    if (!shouldBotRespond(personality, content, isMentioned)) continue;

    // Find a mentioned creature name for context
    const mentionedCreature = mentions.find((m) => m.type === 'creature')?.name;

    const response = generateBotResponse(personality, senderName, mentionedCreature);

    // Insert with a delayed createdAt (10-30 seconds in the future)
    const delayMs = 10_000 + Math.random() * 20_000;
    const delayedTime = new Date(Date.now() + delayMs);

    await db.insert(chatMessages).values({
      userId: bot.id,
      content: response,
      mentions: [],
      createdAt: delayedTime,
    });
  }
}
