import { NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import { battles, creatures } from '@/lib/db/schema';
import { users } from '@/lib/db/schema/users';
import { eq, or, desc, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// GET — List recent farming battle history
// ---------------------------------------------------------------------------

export async function GET() {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  // Fetch farming battles involving the current user, most recent first
  const recentBattles = await db
    .select({
      battle: battles,
      challengerCreatureName: sql<string>`c1.name`,
      defenderCreatureName: sql<string>`c2.name`,
      challengerUserName: sql<string>`u1.display_name`,
      defenderUserName: sql<string>`u2.display_name`,
    })
    .from(battles)
    .innerJoin(
      sql`creatures c1`,
      sql`c1.id = ${battles.challengerCreatureId}`,
    )
    .innerJoin(
      sql`creatures c2`,
      sql`c2.id = ${battles.defenderCreatureId}`,
    )
    .innerJoin(
      sql`users u1`,
      sql`u1.id = ${battles.challengerUserId}`,
    )
    .innerJoin(
      sql`users u2`,
      sql`u2.id = ${battles.defenderUserId}`,
    )
    .where(
      sql`${battles.battleMode} = 'farming' AND (${battles.challengerUserId} = ${session.userId} OR ${battles.defenderUserId} = ${session.userId})`,
    )
    .orderBy(desc(battles.createdAt))
    .limit(60); // Fetch extra to group by squadBattleId

  // Group by squadBattleId for multi-duel battles
  const grouped = new Map<
    string,
    {
      squadBattleId: string | null;
      format: string;
      duels: typeof recentBattles;
      createdAt: Date;
      challengerUserId: string;
      defenderUserId: string;
      challengerUserName: string;
      defenderUserName: string;
    }
  >();

  for (const b of recentBattles) {
    const key = b.battle.squadBattleId ?? b.battle.id;
    if (!grouped.has(key)) {
      grouped.set(key, {
        squadBattleId: b.battle.squadBattleId,
        format: b.battle.squadBattleId ? 'squad' : '1v1',
        duels: [],
        createdAt: b.battle.createdAt,
        challengerUserId: b.battle.challengerUserId,
        defenderUserId: b.battle.defenderUserId,
        challengerUserName: b.challengerUserName,
        defenderUserName: b.defenderUserName,
      });
    }
    grouped.get(key)!.duels.push(b);
  }

  // Determine format and winner for grouped battles
  const result = [...grouped.values()]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 20)
    .map((g) => {
      const duelCount = g.duels.length;
      const format = duelCount === 1 ? '1v1' : duelCount === 2 ? '2v2' : '3v3';

      let team1Wins = 0;
      let team2Wins = 0;
      for (const d of g.duels) {
        if (d.battle.winnerCreatureId) {
          if (d.battle.winnerCreatureId === d.battle.challengerCreatureId) {
            team1Wins++;
          } else {
            team2Wins++;
          }
        }
      }

      const overallWinner =
        team1Wins > team2Wins
          ? g.challengerUserId
          : team2Wins > team1Wins
            ? g.defenderUserId
            : null;

      const isChallenger = g.challengerUserId === session.userId;
      const myResult =
        overallWinner === null
          ? 'draw'
          : overallWinner === session.userId
            ? 'victory'
            : 'defeat';

      return {
        squadBattleId: g.squadBattleId,
        format,
        result: myResult,
        opponentName: isChallenger ? g.defenderUserName : g.challengerUserName,
        opponentUserId: isChallenger ? g.defenderUserId : g.challengerUserId,
        createdAt: g.createdAt.toISOString(),
        duels: g.duels
          .sort((a, b) => (a.battle.duelIndex ?? 0) - (b.battle.duelIndex ?? 0))
          .map((d) => ({
            battleId: d.battle.id,
            duelIndex: d.battle.duelIndex ?? 0,
            challengerCreature: {
              id: d.battle.challengerCreatureId,
              name: d.challengerCreatureName,
            },
            defenderCreature: {
              id: d.battle.defenderCreatureId,
              name: d.defenderCreatureName,
            },
            winnerId: d.battle.winnerCreatureId,
            rounds: d.battle.roundsPlayed,
            challengerHpPercent: d.battle.challengerHpPercent,
            defenderHpPercent: d.battle.defenderHpPercent,
            kinshipMalus: d.battle.kinshipMalus,
            teamBonus: d.battle.teamBonus,
          })),
      };
    });

  return NextResponse.json({ data: result });
}
