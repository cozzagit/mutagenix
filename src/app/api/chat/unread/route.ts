import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { chatMessages, users, creatures } from '@/lib/db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// GET /api/chat/unread — Count unread mentions for current user
// ---------------------------------------------------------------------------

export async function GET() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  try {
    // Get user's lastChatRead
    const [user] = await db
      .select({ lastChatRead: users.lastChatRead })
      .from(users)
      .where(eq(users.id, session.userId));

    const threshold = user?.lastChatRead ?? new Date(0);

    // Get user's creature IDs for mention checking
    const userCreatures = await db
      .select({ id: creatures.id })
      .from(creatures)
      .where(eq(creatures.userId, session.userId));

    const creatureIds = userCreatures.map((c) => c.id);
    const searchIds = [session.userId, ...creatureIds];

    // Count messages after threshold that mention the user or their creatures
    // Use text search on the JSONB mentions field for simplicity
    // IDs come from session auth + DB, so sql.raw is safe here
    const likeConditions = searchIds.map((id) => `mentions::text LIKE '%${id}%'`).join(' OR ');

    if (searchIds.length === 0) {
      return NextResponse.json({ data: { unreadMentions: 0 } });
    }

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(
        and(
          gt(chatMessages.createdAt, threshold),
          sql.raw(`(${likeConditions})`),
        ),
      );

    return NextResponse.json({
      data: { unreadMentions: result?.count ?? 0 },
    });
  } catch (error) {
    console.error('[Chat Unread] Error:', error);
    return NextResponse.json({ data: { unreadMentions: 0 } });
  }
}
