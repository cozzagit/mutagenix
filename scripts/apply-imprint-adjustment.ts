/**
 * Apply soft retroactive genetic imprint adjustment to all Gen 2+ offspring.
 * 50% strength — mild correction, not dramatic.
 * Recalculates trait values and visual params.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, sql } from 'drizzle-orm';
import { creatures } from '../src/lib/db/schema/creatures';
import { mapTraitsToVisuals } from '../src/lib/game-engine/visual-mapper';
import { ELEMENTS, TRAITS, ELEMENT_TRAIT_WEIGHTS, type ElementId, type TraitId } from '../src/lib/game-engine/constants';
import type { TraitValues, ElementLevels } from '../src/lib/db/schema/creatures';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mutagenix';
const client = postgres(connectionString);
const db = drizzle(client);

const ADJUSTMENT_STRENGTH = 0.5; // 50% of the theoretical imprint effect

async function main() {
  const offspring = await db.select().from(creatures).where(
    and(
      sql`${creatures.familyGeneration} > 1`,
      eq(creatures.isArchived, false),
      eq(creatures.isDead, false),
    )
  );

  console.log(`Processing ${offspring.length} offspring for imprint adjustment (${ADJUSTMENT_STRENGTH * 100}% strength)...\n`);

  for (const c of offspring) {
    const imprint = c.geneticImprint as Record<string, number> | null;
    if (!imprint) {
      console.log(`  ${c.name}: no imprint, skip`);
      continue;
    }

    const tv = { ...(c.traitValues as Record<string, number>) };
    const el = c.elementLevels as Record<string, number>;
    let changed = false;
    const changes: string[] = [];

    for (const trait of TRAITS) {
      let imprintEffect = 0;
      let neutralEffect = 0;

      for (const elem of ELEMENTS) {
        const elLevel = el[elem] ?? 0;
        const weight = (ELEMENT_TRAIT_WEIGHTS[elem] as Record<string, number>)[trait] ?? 0;
        const coeff = imprint[elem] ?? 1.0;

        imprintEffect += elLevel * weight * coeff;
        neutralEffect += elLevel * weight;
      }

      if (neutralEffect > 0.01 && Math.abs(imprintEffect - neutralEffect) > 0.01) {
        const ratio = imprintEffect / neutralEffect;
        const adjustment = (ratio - 1.0) * ADJUSTMENT_STRENGTH;
        const oldVal = tv[trait] ?? 0;

        if (oldVal > 0.1) {
          const newVal = Math.max(0, Math.min(100, oldVal * (1 + adjustment)));
          if (Math.abs(newVal - oldVal) > 0.05) {
            tv[trait] = newVal;
            changed = true;
            changes.push(`${trait} ${oldVal.toFixed(1)}→${newVal.toFixed(1)}`);
          }
        }
      }
    }

    if (changed) {
      const newVisuals = mapTraitsToVisuals(
        tv as TraitValues,
        el as ElementLevels,
        [],
        c.foundingElements ?? null,
        c.growthElements ?? null,
      );

      await db.update(creatures).set({
        traitValues: tv as TraitValues,
        visualParams: newVisuals as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      }).where(eq(creatures.id, c.id));

      console.log(`  Gen${c.familyGeneration} ${c.name}: ${changes.slice(0, 5).join(', ')}`);
    } else {
      console.log(`  Gen${c.familyGeneration} ${c.name}: no significant change`);
    }
  }

  console.log('\nDone!');
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
