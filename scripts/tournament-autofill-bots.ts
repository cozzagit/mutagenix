/**
 * Auto-fill tournament with bot creatures as enrollment deadline approaches.
 * Run periodically (e.g. every hour) leading up to the tournament start.
 * Fills empty slots with the strongest available bot creatures.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/tournament-autofill-bots.ts [tournamentId]
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, sql, ne } from 'drizzle-orm';
import { tournaments } from '../src/lib/db/schema/tournaments';
import { tournamentParticipants } from '../src/lib/db/schema/tournament-participants';
import { creatures } from '../src/lib/db/schema/creatures';
import { users } from '../src/lib/db/schema/users';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mutagenix';
const client = postgres(connectionString);
const db = drizzle(client);

const TOURNAMENT_ID = process.argv[2] || 'b77a6f1f-63ff-490a-b413-315abc3078ef';

async function main() {
  // Get tournament
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, TOURNAMENT_ID));
  if (!tournament) {
    console.error('Tournament not found');
    process.exit(1);
  }

  console.log(`Tournament: ${tournament.name}`);
  console.log(`Status: ${tournament.status}`);
  console.log(`Max: ${tournament.maxParticipants}`);

  if (tournament.status !== 'enrollment') {
    console.log('Tournament not in enrollment phase, skip.');
    await client.end();
    return;
  }

  // Count current participants
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tournamentParticipants)
    .where(eq(tournamentParticipants.tournamentId, TOURNAMENT_ID));

  const currentCount = countResult?.count ?? 0;
  const maxSlots = tournament.maxParticipants ?? 16;
  const emptySlots = maxSlots - currentCount;

  console.log(`Current: ${currentCount}/${maxSlots} — ${emptySlots} empty slots`);

  if (emptySlots <= 0) {
    console.log('Tournament is full!');
    await client.end();
    return;
  }

  // Get already enrolled creature IDs
  const enrolled = await db
    .select({ squadSnapshot: tournamentParticipants.squadSnapshot, userId: tournamentParticipants.userId })
    .from(tournamentParticipants)
    .where(eq(tournamentParticipants.tournamentId, TOURNAMENT_ID));

  const enrolledUserIds = new Set(enrolled.map(e => e.userId));
  const enrolledCreatureIds = new Set<string>();
  for (const e of enrolled) {
    const snap = e.squadSnapshot as { starters?: string[]; creatureIds?: string[] } | null;
    const ids = snap?.starters ?? snap?.creatureIds ?? [];
    for (const id of ids) enrolledCreatureIds.add(id);
  }

  // Find bot users
  const botUsers = await db.select().from(users).where(sql`${users.email} LIKE '%@mutagenix.io'`);
  const botUserIds = new Set(botUsers.map(b => b.id));

  // Find all eligible bot creatures (warrior phase, alive, not already enrolled)
  const allBotCreatures = await db.select().from(creatures).where(
    and(
      eq(creatures.isArchived, false),
      eq(creatures.isDead, false),
      sql`${creatures.ageDays} >= 40`,
    ),
  );

  // Filter to bot creatures not already enrolled, sort by ageDays (strongest first)
  const eligible = allBotCreatures
    .filter(c => botUserIds.has(c.userId) && !enrolledCreatureIds.has(c.id))
    // Also skip if this bot user already has a creature enrolled
    .filter(c => {
      // Allow multiple creatures from same bot user (they have offspring now)
      return true;
    })
    .sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0));

  console.log(`Eligible bot creatures: ${eligible.length}`);

  // Fill empty slots
  const toEnroll = eligible.slice(0, emptySlots);
  let added = 0;

  for (const creature of toEnroll) {
    // Check this user doesn't already have an entry (one per user)
    if (enrolledUserIds.has(creature.userId)) {
      console.log(`  ${creature.name} (${creature.userId}): user already enrolled, skip`);
      continue;
    }

    try {
      await db.insert(tournamentParticipants).values({
        tournamentId: TOURNAMENT_ID,
        userId: creature.userId,
        squadSnapshot: { starters: [creature.id], reserves: [] },
      });

      enrolledUserIds.add(creature.userId);
      added++;
      console.log(`  Added: ${creature.name} (Day ${creature.ageDays})`);
    } catch (err) {
      console.log(`  Failed to add ${creature.name}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  console.log(`\nAdded ${added} bot creatures. Total: ${currentCount + added}/${maxSlots}`);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
