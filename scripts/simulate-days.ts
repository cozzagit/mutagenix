/**
 * Simulate N days of injections for the admin creature.
 * Usage: npx tsx scripts/simulate-days.ts [days=4]
 *
 * Distributes 50 credits across elements with some variety per day.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { creatures } from '../src/lib/db/schema/creatures';
import { allocations } from '../src/lib/db/schema/allocations';
import { dailySnapshots } from '../src/lib/db/schema/daily-snapshots';
import { mutationLog } from '../src/lib/db/schema/mutation-log';
import { processDailyMutation, type CreatureInput } from '../src/lib/game-engine/mutation-engine';
import { users } from '../src/lib/db/schema/users';

const connectionString = 'postgresql://postgres:postgres@localhost:5432/mutagenix';
const sql = postgres(connectionString);
const db = drizzle(sql);

const DAYS = parseInt(process.argv[2] || '4', 10);

// Different allocation patterns per day for variety
const DAILY_ALLOCATIONS: Record<string, number>[] = [
  { C: 10, O: 10, N: 8, Fe: 7, Ca: 5, P: 5, K: 3, Na: 2, S: 0, Cl: 0 },
  { Fe: 12, O: 10, Ca: 8, C: 6, P: 5, K: 4, S: 3, Na: 2, N: 0, Cl: 0 },
  { K: 10, Na: 10, P: 8, O: 7, C: 5, Fe: 4, N: 3, Ca: 2, S: 1, Cl: 0 },
  { S: 10, Cl: 8, Fe: 8, C: 6, O: 5, N: 4, Ca: 4, P: 3, K: 1, Na: 1 },
  { Ca: 12, P: 10, C: 8, Fe: 6, O: 5, N: 4, K: 3, Na: 2, S: 0, Cl: 0 },
  { N: 10, C: 10, O: 10, P: 5, K: 5, Fe: 4, Ca: 3, Na: 2, S: 1, Cl: 0 },
];

async function main() {
  console.log(`Simulating ${DAYS} days of injections...\n`);

  // Find admin user's creature
  const [admin] = await db.select().from(users).where(eq(users.isAdmin, true));
  if (!admin) {
    console.error('No admin user found. Run npm run seed first.');
    process.exit(1);
  }

  let [creature] = await db.select().from(creatures).where(eq(creatures.userId, admin.id));
  if (!creature) {
    console.error('No creature found for admin.');
    process.exit(1);
  }

  console.log(`Creature: ${creature.name} (Day ${creature.ageDays})`);

  for (let day = 1; day <= DAYS; day++) {
    const credits = DAILY_ALLOCATIONS[(day - 1) % DAILY_ALLOCATIONS.length];
    const totalCredits = Object.values(credits).reduce((a, b) => a + b, 0);
    const dayKey = String((creature.ageDays ?? 0) + 1);

    console.log(`\n--- Day ${dayKey} ---`);
    console.log(`Credits: ${JSON.stringify(credits)} (total: ${totalCredits})`);

    // Save allocation
    await db.insert(allocations).values({
      creatureId: creature.id,
      day: dayKey,
      credits,
      totalCredits,
    });

    // Run mutation engine
    const input: CreatureInput = {
      id: creature.id,
      elementLevels: creature.elementLevels as Record<string, number>,
      traitValues: creature.traitValues as Record<string, number>,
      ageDays: creature.ageDays ?? 0,
      stability: creature.stability ?? 0.5,
      day: (creature.ageDays ?? 0) + 1,
    };

    const result = processDailyMutation(input, credits);

    // Apply mutation directly (no gradual — instant for simulation)
    const now = new Date();
    await db
      .update(creatures)
      .set({
        elementLevels: result.newElementLevels,
        traitValues: result.newTraitValues,
        visualParams: result.newVisualParams as unknown as Record<string, unknown>,
        stability: result.newStability,
        ageDays: (creature.ageDays ?? 0) + 1,
        targetElementLevels: null,
        targetTraitValues: null,
        targetVisualParams: null,
        mutationStartedAt: null,
        mutationEndsAt: null,
        updatedAt: now,
      })
      .where(eq(creatures.id, creature.id));

    // Save snapshot
    await db.insert(dailySnapshots).values({
      creatureId: creature.id,
      day: dayKey,
      elementLevels: result.newElementLevels,
      traitValues: result.newTraitValues,
      visualParams: result.newVisualParams as unknown as Record<string, unknown>,
      stabilityScore: result.newStability,
      mutationsApplied: result.mutations.map((m) => ({
        traitId: m.traitId,
        delta: m.delta,
        trigger: m.triggerType,
      })),
    });

    // Save mutation log
    if (result.mutations.length > 0) {
      const triggerTypeMap: Record<string, 'element' | 'synergy' | 'decay' | 'threshold' | 'noise'> = {
        growth: 'element', synergy: 'synergy', decay: 'decay', noise: 'noise',
      };
      await db.insert(mutationLog).values(
        result.mutations.map((m) => ({
          creatureId: creature.id,
          day: dayKey,
          traitId: m.traitId,
          oldValue: m.oldValue,
          newValue: m.newValue,
          delta: m.delta,
          triggerType: triggerTypeMap[m.triggerType] ?? 'element',
          triggerDetails: m.triggerDetails ?? null,
        })),
      );
    }

    console.log(`Stability: ${result.newStability.toFixed(3)}`);
    console.log(`Active synergies: ${result.activeSynergies.length > 0 ? result.activeSynergies.join(', ') : 'none'}`);
    console.log(`Mutations: ${result.mutations.length} trait changes`);

    // Re-fetch creature for next iteration
    [creature] = await db.select().from(creatures).where(eq(creatures.id, creature.id));
  }

  console.log(`\n✅ Simulation complete! Creature is now at Day ${creature.ageDays}`);
  console.log(`Element levels:`, creature.elementLevels);
  console.log(`Trait values:`, creature.traitValues);

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
