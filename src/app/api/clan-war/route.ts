import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { clanWars, clans } from '@/lib/db/schema';
import { eq, or, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  void session; // authenticated but not used for filtering directly

  const { searchParams } = new URL(request.url);
  const clanId = searchParams.get('clanId');

  if (!clanId) {
    return NextResponse.json(
      { error: { code: 'MISSING_PARAMS', message: 'clanId è obbligatorio' } },
      { status: 400 },
    );
  }

  // Get all wars involving this clan
  const wars = await db
    .select({
      war: clanWars,
      challengerClan: {
        name: sql<string>`c1.name`,
      },
      defenderClan: {
        name: sql<string>`c2.name`,
      },
    })
    .from(clanWars)
    .innerJoin(
      sql`${clans} AS c1`,
      sql`c1.id = ${clanWars.challengerClanId}`,
    )
    .innerJoin(
      sql`${clans} AS c2`,
      sql`c2.id = ${clanWars.defenderClanId}`,
    )
    .where(
      or(
        eq(clanWars.challengerClanId, clanId),
        eq(clanWars.defenderClanId, clanId),
      ),
    )
    .orderBy(sql`${clanWars.createdAt} DESC`)
    .limit(50);

  const data = wars.map((w) => ({
    id: w.war.id,
    challengerClanId: w.war.challengerClanId,
    challengerClanName: w.challengerClan.name,
    defenderClanId: w.war.defenderClanId,
    defenderClanName: w.defenderClan.name,
    format: w.war.format,
    status: w.war.status,
    challengerWins: w.war.challengerWins,
    defenderWins: w.war.defenderWins,
    winnerClanId: w.war.winnerClanId,
    createdAt: w.war.createdAt.toISOString(),
  }));

  return NextResponse.json({ data });
}
