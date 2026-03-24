/**
 * Evolve a creature by name for N days.
 * Usage: npx tsx scripts/evolve-by-name.ts <name> [days=30]
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, sql as drizzleSql } from 'drizzle-orm';
import { creatures } from '../src/lib/db/schema/creatures';
import { allocations } from '../src/lib/db/schema/allocations';
import { dailySnapshots } from '../src/lib/db/schema/daily-snapshots';
import { processDailyMutation, type CreatureInput } from '../src/lib/game-engine/mutation-engine';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mutagenix';
const sql = postgres(connectionString);
const db = drizzle(sql);

const NAME = process.argv[2];
const DAYS = parseInt(process.argv[3] || '30', 10);

if (!NAME) {
  console.error('Usage: npx tsx scripts/evolve-by-name.ts <creature-name> [days=30]');
  process.exit(1);
}

// Varied allocation patterns for organic growth
const RECIPES: Record<string, number>[] = [
  { C: 10, O: 10, N: 8, Fe: 7, Ca: 5, P: 5, K: 3, Na: 2, S: 0, Cl: 0 },
  { Fe: 12, O: 10, Ca: 8, C: 6, P: 5, K: 4, S: 3, Na: 2, N: 0, Cl: 0 },
  { K: 10, Na: 10, P: 8, O: 7, C: 5, Fe: 4, N: 3, Ca: 2, S: 1, Cl: 0 },
  { S: 10, Cl: 8, Fe: 8, C: 6, O: 5, N: 4, Ca: 4, P: 3, K: 1, Na: 1 },
  { Ca: 12, P: 10, C: 8, Fe: 6, O: 5, N: 4, K: 3, Na: 2, S: 0, Cl: 0 },
  { N: 10, C: 10, O: 10, P: 5, K: 5, Fe: 4, Ca: 3, Na: 2, S: 1, Cl: 0 },
];

async function main() {
  // Find creature by name (case-insensitive)
  let [creature] = await db.select().from(creatures)
    .where(drizzleSql`lower(${creatures.name}) = ${NAME.toLowerCase()}`);

  if (!creature) {
    console.error(`Creature "${NAME}" not found.`);
    process.exit(1);
  }

  console.log(`Evolving ${creature.name} from Day ${creature.ageDays} for ${DAYS} days...\n`);

  for (let day = 1; day <= DAYS; day++) {
    const credits = RECIPES[(day - 1) % RECIPES.length];
    const totalCredits = Object.values(credits).reduce((a, b) => a + b, 0);
    const dayKey = String((creature.ageDays ?? 0) + 1);

    // Save allocation
    await db.insert(allocations).values({
      creatureId: creature.id,
      day: dayKey,
      credits,
      totalCredits,
    });

    // Run mutation
    const input: CreatureInput = {
      id: creature.id,
      elementLevels: creature.elementLevels as Record<string, number>,
      traitValues: creature.traitValues as Record<string, number>,
      ageDays: creature.ageDays ?? 0,
      stability: creature.stability ?? 0.5,
      day: (creature.ageDays ?? 0) + 1,
      foundingElements: creature.foundingElements ?? null,
      growthElements: creature.growthElements ?? null,
    };

    const result = processDailyMutation(input, credits);

    // Apply
    const now = new Date();
    await db.update(creatures).set({
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
    }).where(eq(creatures.id, creature.id));

    // Snapshot
    await db.insert(dailySnapshots).values({
      creatureId: creature.id,
      day: dayKey,
      elementLevels: result.newElementLevels,
      traitValues: result.newTraitValues,
      visualParams: result.newVisualParams as unknown as Record<string, unknown>,
      stabilityScore: result.newStability,
      mutationsApplied: result.mutations.map((m) => ({
        traitId: m.traitId, delta: m.delta, trigger: m.triggerType,
      })),
    });

    // Re-fetch
    [creature] = await db.select().from(creatures).where(eq(creatures.id, creature.id));

    if (day % 10 === 0) {
      console.log(`Day ${creature.ageDays}: stability=${(creature.stability ?? 0).toFixed(3)}`);
    }
  }

  const tv = creature.traitValues as Record<string, number>;
  console.log(`\nDone! ${creature.name} is now Day ${creature.ageDays}`);
  console.log(`ATK: ${(tv.attackPower ?? 0).toFixed(1)} | DEF: ${(tv.defense ?? 0).toFixed(1)} | SPD: ${(tv.speed ?? 0).toFixed(1)} | STA: ${(tv.stamina ?? 0).toFixed(1)}`);
  console.log(`Stability: ${(creature.stability ?? 0).toFixed(3)}`);

  await sql.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
