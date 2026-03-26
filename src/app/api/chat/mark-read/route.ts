import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// POST /api/chat/mark-read — Update lastChatRead to NOW()
// ---------------------------------------------------------------------------

export async function POST() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  try {
    await db
      .update(users)
      .set({ lastChatRead: new Date() })
      .where(eq(users.id, session.userId));

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('[Chat Mark Read] Error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Errore' } },
      { status: 500 },
    );
  }
}
