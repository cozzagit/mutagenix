import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  clans,
  clanMemberships,
  creatures,
  users,
} from '@/lib/db/schema';
import { eq, and, ne, desc, sql } from 'drizzle-orm';

export async function GET() {
  // Get all non-disbanded clans
  const allClans = await db
    .select()
    .from(clans)
    .where(ne(clans.status, 'disbanded'))
    .orderBy(desc(clans.prestige), desc(clans.clanElo));

  // For each clan, find the boss creature
  const clanIds = allClans.map((c) => c.id);

  let bossMembers: { clanId: string; creatureName: string; ownerName: string }[] = [];
  if (clanIds.length > 0) {
    bossMembers = await db
      .select({
        clanId: clanMemberships.clanId,
        creatureName: creatures.name,
        ownerName: users.displayName,
      })
      .from(clanMemberships)
      .innerJoin(creatures, eq(creatures.id, clanMemberships.creatureId))
      .innerJoin(users, eq(users.id, clanMemberships.userId))
      .where(
        and(
          sql`${clanMemberships.clanId} IN (${sql.join(clanIds.map(id => sql`${id}::uuid`), sql`, `)})`,
          eq(clanMemberships.role, 'boss'),
        ),
      );
  }

  const bossMap = new Map<string, { creatureName: string; ownerName: string }>();
  for (const b of bossMembers) {
    bossMap.set(b.clanId, { creatureName: b.creatureName, ownerName: b.ownerName });
  }

  const rankedList = allClans.map((clan, i) => {
    const boss = bossMap.get(clan.id);
    return {
      position: i + 1,
      id: clan.id,
      name: clan.name,
      emblemColor: clan.emblemColor,
      status: clan.status,
      memberCount: clan.totalMembers,
      clanElo: clan.clanElo,
      prestige: clan.prestige,
      clanWins: clan.clanWins,
      clanLosses: clan.clanLosses,
      bossCreatureName: boss?.creatureName ?? '???',
      bossOwnerName: boss?.ownerName ?? '???',
    };
  });

  return NextResponse.json({ data: rankedList });
}
