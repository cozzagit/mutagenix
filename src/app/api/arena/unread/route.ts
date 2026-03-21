import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { battles } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export async function GET() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  // Count battles where user was DEFENDER in the last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(battles)
    .where(
      and(
        eq(battles.defenderUserId, session.userId),
        gte(battles.createdAt, twentyFourHoursAgo),
      ),
    );

  return NextResponse.json({
    data: {
      unseenBattles: result?.count ?? 0,
    },
  });
}
