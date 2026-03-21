import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { battles, users } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export async function GET() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  try {
    // Get last arena visit timestamp
    const [user] = await db.select({ lastArenaVisit: users.lastArenaVisit })
      .from(users).where(eq(users.id, session.userId));
    const threshold = user?.lastArenaVisit ?? new Date(0);

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(battles)
      .where(
        and(
          eq(battles.defenderUserId, session.userId),
          gte(battles.createdAt, threshold),
        ),
      );

    return NextResponse.json({
      data: { unseenBattles: result?.count ?? 0 },
    });
  } catch {
    return NextResponse.json({ data: { unseenBattles: 0 } });
  }
}
