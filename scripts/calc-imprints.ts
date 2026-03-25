/**
 * Calculate and store genetic imprints for all Gen 1 creatures.
 * Usage: DATABASE_URL=... npx tsx scripts/calc-imprints.ts
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { creatures } from '../src/lib/db/schema/creatures';
import { calculateGeneticImprint } from '../src/lib/game-engine/genetic-imprint';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mutagenix';
const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  const rows = await db.select({
    id: creatures.id,
    name: creatures.name,
    foundingElements: creatures.foundingElements,
  }).from(creatures).where(
    and(
      eq(creatures.familyGeneration, 1),
      isNull(creatures.geneticImprint),
      eq(creatures.isArchived, false),
    ),
  );

  console.log(`Found ${rows.length} Gen 1 creatures without imprint.`);

  for (const row of rows) {
    const imprint = calculateGeneticImprint(row.foundingElements as Record<string, number> | null);
    await db.update(creatures)
      .set({ geneticImprint: imprint })
      .where(eq(creatures.id, row.id));

    // Show top 3 strongest elements
    const sorted = Object.entries(imprint).sort(([,a], [,b]) => b - a);
    const top3 = sorted.slice(0, 3).map(([el, v]) => `${el}=${v.toFixed(2)}`).join(', ');
    console.log(`  ${row.name}: ${top3}`);
  }

  console.log('Done!');
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
