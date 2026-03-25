import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { clans } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  void session;

  // Get all active clans with at least 3 members
  const activeClansList = await db
    .select({
      id: clans.id,
      name: clans.name,
      clanElo: clans.clanElo,
      totalMembers: clans.totalMembers,
    })
    .from(clans)
    .where(
      sql`${clans.status} = 'active' AND ${clans.totalMembers} >= 3`,
    )
    .orderBy(sql`${clans.clanElo} DESC`);

  return NextResponse.json({ data: activeClansList });
}
