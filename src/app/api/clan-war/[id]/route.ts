import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { clanWars, clanWarMatches, clans, creatures } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  void session;

  const { id: warId } = await context.params;

  // Get war with clan names
  const [warRow] = await db
    .select({
      war: clanWars,
      challengerClanName: sql<string>`c1.name`,
      challengerClanColor: sql<string>`c1.emblem_color`,
      defenderClanName: sql<string>`c2.name`,
      defenderClanColor: sql<string>`c2.emblem_color`,
    })
    .from(clanWars)
    .innerJoin(sql`${clans} AS c1`, sql`c1.id = ${clanWars.challengerClanId}`)
    .innerJoin(sql`${clans} AS c2`, sql`c2.id = ${clanWars.defenderClanId}`)
    .where(eq(clanWars.id, warId));

  if (!warRow) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Guerra non trovata' } },
      { status: 404 },
    );
  }

  // Get matches
  const matches = await db
    .select({
      match: clanWarMatches,
      creature1Name: sql<string>`c1.name`,
      creature2Name: sql<string>`c2.name`,
    })
    .from(clanWarMatches)
    .innerJoin(sql`${creatures} AS c1`, sql`c1.id = ${clanWarMatches.creature1Id}`)
    .innerJoin(sql`${creatures} AS c2`, sql`c2.id = ${clanWarMatches.creature2Id}`)
    .where(eq(clanWarMatches.clanWarId, warId))
    .orderBy(sql`${clanWarMatches.matchIndex} ASC`);

  return NextResponse.json({
    data: {
      war: {
        id: warRow.war.id,
        challengerClanId: warRow.war.challengerClanId,
        challengerClanName: warRow.challengerClanName,
        challengerClanColor: warRow.challengerClanColor,
        defenderClanId: warRow.war.defenderClanId,
        defenderClanName: warRow.defenderClanName,
        defenderClanColor: warRow.defenderClanColor,
        format: warRow.war.format,
        status: warRow.war.status,
        challengerWins: warRow.war.challengerWins,
        defenderWins: warRow.war.defenderWins,
        winnerClanId: warRow.war.winnerClanId,
        prestigeStakes: warRow.war.prestigeStakes,
        challengerEloBefore: warRow.war.challengerEloBefore,
        defenderEloBefore: warRow.war.defenderEloBefore,
        challengerEloAfter: warRow.war.challengerEloAfter,
        defenderEloAfter: warRow.war.defenderEloAfter,
        startedAt: warRow.war.startedAt?.toISOString() ?? null,
        completedAt: warRow.war.completedAt?.toISOString() ?? null,
        createdAt: warRow.war.createdAt.toISOString(),
      },
      matches: matches.map((m) => ({
        id: m.match.id,
        matchIndex: m.match.matchIndex,
        creature1Id: m.match.creature1Id,
        creature1Name: m.creature1Name,
        creature2Id: m.match.creature2Id,
        creature2Name: m.creature2Name,
        battleId: m.match.battleId,
        winnerCreatureId: m.match.winnerCreatureId,
        status: m.match.status,
        hpPercent1: m.match.hpPercent1,
        hpPercent2: m.match.hpPercent2,
      })),
    },
  });
}
