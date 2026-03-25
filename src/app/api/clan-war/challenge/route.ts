import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSession,
  unauthorizedResponse,
} from '@/lib/auth/get-session';
import { db } from '@/lib/db';
import {
  clans,
  clanMemberships,
  clanWars,
  creatures,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await getRequiredSession();
  } catch {
    return unauthorizedResponse();
  }

  let body: { defenderClanId: string; format?: string; roster?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Corpo richiesta non valido' } },
      { status: 400 },
    );
  }

  const { defenderClanId, format = 'bo5' } = body;

  if (!defenderClanId) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'defenderClanId è obbligatorio' } },
      { status: 400 },
    );
  }

  if (!['bo3', 'bo5', 'bo7'].includes(format)) {
    return NextResponse.json(
      { error: { code: 'INVALID_FORMAT', message: 'Formato non valido (bo3, bo5, bo7)' } },
      { status: 400 },
    );
  }

  // Verify caller is boss of their clan
  const [callerMembership] = await db
    .select({ membership: clanMemberships })
    .from(clanMemberships)
    .where(
      and(
        eq(clanMemberships.userId, session.userId),
        eq(clanMemberships.role, 'boss'),
      ),
    );

  if (!callerMembership) {
    return NextResponse.json(
      { error: { code: 'NOT_BOSS', message: 'Solo il Boss può dichiarare guerra' } },
      { status: 403 },
    );
  }

  const challengerClanId = callerMembership.membership.clanId;

  if (challengerClanId === defenderClanId) {
    return NextResponse.json(
      { error: { code: 'SELF_CHALLENGE', message: 'Non puoi sfidare il tuo stesso clan' } },
      { status: 400 },
    );
  }

  // Verify both clans are active
  const [challengerClan] = await db.select().from(clans).where(eq(clans.id, challengerClanId));
  const [defenderClan] = await db.select().from(clans).where(eq(clans.id, defenderClanId));

  if (!challengerClan || challengerClan.status !== 'active') {
    return NextResponse.json(
      { error: { code: 'CLAN_NOT_ACTIVE', message: 'Il tuo clan non è attivo' } },
      { status: 400 },
    );
  }

  if (!defenderClan || defenderClan.status !== 'active') {
    return NextResponse.json(
      { error: { code: 'DEFENDER_NOT_ACTIVE', message: 'Il clan avversario non è attivo' } },
      { status: 400 },
    );
  }

  // Check no pending/in_progress war between these two clans
  const [existingWar] = await db
    .select()
    .from(clanWars)
    .where(
      sql`(
        (${clanWars.challengerClanId} = ${challengerClanId} AND ${clanWars.defenderClanId} = ${defenderClanId})
        OR
        (${clanWars.challengerClanId} = ${defenderClanId} AND ${clanWars.defenderClanId} = ${challengerClanId})
      ) AND ${clanWars.status} IN ('pending', 'accepted', 'in_progress')`,
    );

  if (existingWar) {
    return NextResponse.json(
      { error: { code: 'WAR_EXISTS', message: 'Esiste già una guerra in corso tra questi clan' } },
      { status: 409 },
    );
  }

  // Build challenger roster: all alive non-archived creatures in the clan
  const challengerMembers = await db
    .select({ creatureId: clanMemberships.creatureId })
    .from(clanMemberships)
    .innerJoin(creatures, eq(creatures.id, clanMemberships.creatureId))
    .where(
      and(
        eq(clanMemberships.clanId, challengerClanId),
        eq(creatures.isDead, false),
        eq(creatures.isArchived, false),
      ),
    );

  const challengerRoster = challengerMembers.map((m) => m.creatureId);

  // Create the clan war
  const [war] = await db
    .insert(clanWars)
    .values({
      challengerClanId,
      defenderClanId,
      format,
      status: 'pending',
      challengerEloBefore: challengerClan.clanElo,
      defenderEloBefore: defenderClan.clanElo,
      challengerRoster,
    })
    .returning();

  return NextResponse.json({
    data: {
      id: war.id,
      challengerClanId: war.challengerClanId,
      defenderClanId: war.defenderClanId,
      format: war.format,
      status: war.status,
    },
  }, { status: 201 });
}
