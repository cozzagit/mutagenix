/**
 * Create the first official Mutagenix tournament + auto-enroll bots.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, sql } from 'drizzle-orm';
import { tournaments } from '../src/lib/db/schema/tournaments';
import { tournamentParticipants } from '../src/lib/db/schema/tournament-participants';
import { creatures } from '../src/lib/db/schema/creatures';
import { users } from '../src/lib/db/schema/users';
import { squads } from '../src/lib/db/schema/squads';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mutagenix';
const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  // Create the tournament
  const [tournament] = await db.insert(tournaments).values({
    name: 'Torneo Inaugurale — La Prima Battaglia',
    tournamentType: 'knockout',
    status: 'enrollment',
    battleFormat: '1v1',
    maxParticipants: 16,
    minParticipants: 4,
    entryFee: 0,
    rules: {
      description: 'Il primo torneo ufficiale di Mutagenix! Eliminazione diretta 1v1. Solo i piu forti sopravviveranno.',
      tierMin: 'novice',
    },
    schedule: { roundDurationHours: 24 },
    currentRound: 0,
    enrollmentStart: new Date(),
    enrollmentEnd: new Date('2026-03-26T19:00:00+01:00'),
    startsAt: new Date('2026-03-26T19:00:00+01:00'),
  }).returning();

  console.log(`Tournament created: ${tournament.name} (${tournament.id})`);
  console.log(`Status: ${tournament.status}`);
  console.log(`Enrollment: NOW until 26 March 2026, 19:00 CET`);
  console.log(`Starts: 26 March 2026, 19:00 CET (20:00 game time)`);

  // Auto-enroll all bot creatures that are warrior-phase
  const botUsers = await db.select().from(users).where(sql`${users.email} LIKE '%@mutagenix.io'`);
  console.log(`\nFound ${botUsers.length} bot users`);

  let enrolled = 0;
  for (const bot of botUsers) {
    // Find strongest warrior creature for this bot
    const [bestCreature] = await db.select().from(creatures).where(
      and(
        eq(creatures.userId, bot.id),
        eq(creatures.isArchived, false),
        eq(creatures.isDead, false),
        sql`${creatures.ageDays} >= 40`,
      ),
    ).orderBy(sql`${creatures.ageDays} DESC`).limit(1);

    if (!bestCreature) {
      console.log(`  ${bot.displayName}: no warrior creature, skip`);
      continue;
    }

    // Enroll with this creature as the squad
    await db.insert(tournamentParticipants).values({
      tournamentId: tournament.id,
      userId: bot.id,
      squadSnapshot: { starters: [bestCreature.id], reserves: [] },
    });

    enrolled++;
    console.log(`  ${bot.displayName} enrolled with ${bestCreature.name} (Day ${bestCreature.ageDays})`);
  }

  console.log(`\n${enrolled} bots enrolled. Waiting for human players!`);
  console.log(`Tournament ID: ${tournament.id}`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
