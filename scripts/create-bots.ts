/**
 * Create 5 bot scientists with unique creatures, evolve them to Day 220,
 * and register them in the arena.
 *
 * Usage: npx tsx scripts/create-bots.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users } from '../src/lib/db/schema/users';
import { creatures, DEFAULT_ELEMENT_LEVELS, DEFAULT_TRAIT_VALUES } from '../src/lib/db/schema/creatures';
import { creatureRankings } from '../src/lib/db/schema/creature-rankings';
import { allocations } from '../src/lib/db/schema/allocations';
import { dailySnapshots } from '../src/lib/db/schema/daily-snapshots';
import { processDailyMutation, type CreatureInput } from '../src/lib/game-engine/mutation-engine';
import { ELEMENTS } from '../src/lib/game-engine/constants';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/mutagenix';
const sql = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(sql);

const TARGET_DAY = 220;

// ---------------------------------------------------------------------------
// Bot configurations
// ---------------------------------------------------------------------------

interface BotConfig {
  displayName: string;
  email: string;
  creatureName: string;
  recipes: { from: number; to: number; credits: Record<string, number> }[];
}

const BOTS: BotConfig[] = [
  // 1. Dr. Velenos — "Il Tossico" — S + Cl heavy (toxic/serpentine build)
  {
    displayName: 'Dr. Velenos',
    email: 'bot.velenos@mutagenix.io',
    creatureName: 'Acidmaw',
    recipes: [
      { from: 1, to: 50, credits: { S: 18, Cl: 15, P: 8, Fe: 5, N: 4 } },        // = 50
      { from: 51, to: 150, credits: { S: 15, Cl: 12, P: 10, Fe: 8, K: 5 } },      // = 50
      { from: 151, to: 220, credits: { S: 10, Cl: 10, P: 10, Fe: 10, K: 5, Na: 5 } }, // = 50
    ],
  },
  // 2. Prof. Cerebrum — "Il Genio" — K + Na + P heavy (cerebral/alien build)
  {
    displayName: 'Prof. Cerebrum',
    email: 'bot.cerebrum@mutagenix.io',
    creatureName: 'Neuraxis',
    recipes: [
      { from: 1, to: 50, credits: { K: 15, Na: 12, P: 12, O: 6, N: 5 } },         // = 50
      { from: 51, to: 150, credits: { K: 12, Na: 10, P: 15, O: 8, N: 5 } },        // = 50
      { from: 151, to: 220, credits: { K: 10, Na: 8, P: 12, O: 8, N: 5, Fe: 7 } }, // = 50
    ],
  },
  // 3. Dr. Ossidiana — "La Corazzata" — Ca + C + Fe heavy (armored tank build)
  {
    displayName: 'Dr. Ossidiana',
    email: 'bot.ossidiana@mutagenix.io',
    creatureName: 'Ferrodon',
    recipes: [
      { from: 1, to: 50, credits: { Ca: 18, C: 12, Fe: 10, N: 5, O: 5 } },         // = 50
      { from: 51, to: 150, credits: { Ca: 15, Fe: 12, C: 10, O: 8, N: 5 } },        // = 50
      { from: 151, to: 220, credits: { Ca: 12, Fe: 10, C: 8, S: 8, O: 7, N: 5 } },  // = 50
    ],
  },
  // 4. Prof. Lumina — "La Bioluminescente" — P + O + K heavy (bioluminescent alien build)
  {
    displayName: 'Prof. Lumina',
    email: 'bot.lumina@mutagenix.io',
    creatureName: 'Phosphex',
    recipes: [
      { from: 1, to: 50, credits: { P: 20, O: 12, K: 10, Na: 5, N: 3 } },          // = 50
      { from: 51, to: 150, credits: { P: 15, O: 10, K: 12, Na: 8, N: 5 } },         // = 50
      { from: 151, to: 220, credits: { P: 12, O: 10, K: 10, Na: 8, N: 5, Fe: 5 } }, // = 50
    ],
  },
  // 5. Dr. Organix — "L'Equilibrato" — N + O + C balanced (organic/balanced build)
  {
    displayName: 'Dr. Organix',
    email: 'bot.organix@mutagenix.io',
    creatureName: 'Symbion',
    recipes: [
      { from: 1, to: 50, credits: { N: 12, O: 12, C: 10, Fe: 5, Ca: 5, K: 3, P: 3 } },             // = 50
      { from: 51, to: 150, credits: { N: 10, O: 10, C: 8, Fe: 7, Ca: 5, K: 5, P: 5 } },             // = 50
      { from: 151, to: 220, credits: { N: 8, O: 8, C: 7, Fe: 7, Ca: 5, K: 5, P: 5, S: 3, Na: 2 } }, // = 50
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Validate that every recipe sums to exactly 50 credits. */
function validateRecipes(): void {
  for (const bot of BOTS) {
    for (const recipe of bot.recipes) {
      const total = Object.values(recipe.credits).reduce((a, b) => a + b, 0);
      if (total !== 50) {
        throw new Error(
          `${bot.displayName} recipe days ${recipe.from}-${recipe.to} sums to ${total}, expected 50`,
        );
      }
    }
  }
}

/** Determine rank tier from age in days. */
function rankTierFromAge(ageDays: number): string {
  if (ageDays >= 500) return 'divine';
  if (ageDays >= 300) return 'immortal';
  if (ageDays > 150) return 'legend';
  if (ageDays > 100) return 'veteran';
  if (ageDays > 60) return 'intermediate';
  return 'novice';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  validateRecipes();

  const passwordHash = await hash('BotPassword2026!', 12);

  console.log(`Creating ${BOTS.length} bot scientists, evolving each to Day ${TARGET_DAY}...\n`);

  for (const bot of BOTS) {
    // ------------------------------------------------------------------
    // 1. Check if bot user already exists
    // ------------------------------------------------------------------
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, bot.email))
      .limit(1);

    if (existing) {
      console.log(`[SKIP] ${bot.displayName} (${bot.email}) already exists.\n`);
      continue;
    }

    // ------------------------------------------------------------------
    // 2. Create user
    // ------------------------------------------------------------------
    const [user] = await db
      .insert(users)
      .values({
        email: bot.email,
        passwordHash,
        displayName: bot.displayName,
      })
      .returning({ id: users.id, email: users.email, displayName: users.displayName });

    console.log(`Created user: ${user.displayName} (${user.email})`);

    // ------------------------------------------------------------------
    // 3. Create creature
    // ------------------------------------------------------------------
    const [creature] = await db
      .insert(creatures)
      .values({
        userId: user.id,
        name: bot.creatureName,
        generation: 1,
        ageDays: 0,
        stability: 0.5,
        elementLevels: { ...DEFAULT_ELEMENT_LEVELS },
        traitValues: { ...DEFAULT_TRAIT_VALUES },
        visualParams: {},
        isArchived: false,
      })
      .returning({ id: creatures.id, name: creatures.name });

    console.log(`  Creature: ${creature.name} (${creature.id})`);

    // ------------------------------------------------------------------
    // 4. Evolve to TARGET_DAY
    // ------------------------------------------------------------------
    let els = { ...DEFAULT_ELEMENT_LEVELS } as Record<string, number>;
    let traits = { ...DEFAULT_TRAIT_VALUES } as Record<string, number>;
    let stability = 0.5;

    // Phase accumulators
    const founding: Record<string, number> = {};
    const growth: Record<string, number> = {};
    for (const el of ELEMENTS) {
      founding[el] = 0;
      growth[el] = 0;
    }

    for (let day = 1; day <= TARGET_DAY; day++) {
      // Pick the right recipe for this day range
      const recipeConfig = bot.recipes.find((r) => day >= r.from && day <= r.to);
      const credits = recipeConfig?.credits ?? bot.recipes[bot.recipes.length - 1].credits;

      // Accumulate founding (days 1-15) and growth (days 16-40) phase data
      if (day <= 15) {
        for (const el of ELEMENTS) {
          founding[el] += credits[el] ?? 0;
        }
      } else if (day <= 40) {
        for (const el of ELEMENTS) {
          growth[el] += credits[el] ?? 0;
        }
      }

      // Save allocation record
      await db.insert(allocations).values({
        creatureId: creature.id,
        day: String(day),
        credits,
        totalCredits: Object.values(credits).reduce((a, b) => a + b, 0),
      });

      // Process daily mutation
      const input: CreatureInput = {
        id: creature.id,
        elementLevels: els as Record<string, number>,
        traitValues: traits as Record<string, number>,
        ageDays: day - 1,
        stability,
        day,
        foundingElements: founding,
        growthElements: growth,
      };

      const result = processDailyMutation(input, credits);
      els = result.newElementLevels as Record<string, number>;
      traits = result.newTraitValues as Record<string, number>;
      stability = result.newStability;

      // Save snapshot every 10 days + first day + last day
      if (day === 1 || day % 10 === 0 || day === TARGET_DAY) {
        await db.insert(dailySnapshots).values({
          creatureId: creature.id,
          day: String(day),
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
      }

      // Progress indicator every 50 days
      if (day % 50 === 0) {
        process.stdout.write(`  Day ${day}/${TARGET_DAY} — stability: ${stability.toFixed(3)}\n`);
      }
    }

    // ------------------------------------------------------------------
    // 5. Calculate mouthSize from final elements
    // ------------------------------------------------------------------
    const mouthWeighted =
      (els.Fe ?? 0) * 0.3 +
      (els.S ?? 0) * 0.2 +
      (els.Ca ?? 0) * 0.2 +
      (els.Cl ?? 0) * 0.2 +
      (els.C ?? 0) * 0.1 +
      (els.N ?? 0) * 0.1 +
      (els.O ?? 0) * 0.1;
    traits.mouthSize = Math.min(100, 100 * (1 - Math.exp(-mouthWeighted / 800)));

    // ------------------------------------------------------------------
    // 6. Update creature with final state + phase data
    // ------------------------------------------------------------------
    await db
      .update(creatures)
      .set({
        elementLevels: els,
        traitValues: traits,
        visualParams: {},
        stability,
        ageDays: TARGET_DAY,
        foundingElements: founding,
        growthElements: growth,
        updatedAt: new Date(),
      })
      .where(eq(creatures.id, creature.id));

    // ------------------------------------------------------------------
    // 7. Register in arena
    // ------------------------------------------------------------------
    const tier = rankTierFromAge(TARGET_DAY);

    await db.insert(creatureRankings).values({
      creatureId: creature.id,
      userId: user.id,
      eloRating: 1000,
      rankTier: tier,
    });

    // ------------------------------------------------------------------
    // 8. Report
    // ------------------------------------------------------------------
    const foundingDom = ELEMENTS.reduce((a, b) => (founding[a] > founding[b] ? a : b));
    const growthDom = Object.values(growth).some((v) => v > 0)
      ? ELEMENTS.reduce((a, b) => (growth[a] > growth[b] ? a : b))
      : '-';
    const currentDom = ELEMENTS.reduce((a, b) => ((els[a] ?? 0) > (els[b] ?? 0) ? a : b));

    const topElements = ELEMENTS.map((e) => `${e}=${Math.round(els[e] ?? 0)}`)
      .sort((a, b) => parseInt(b.split('=')[1]) - parseInt(a.split('=')[1]))
      .slice(0, 4)
      .join(', ');

    console.log(`  Day ${TARGET_DAY} reached — tier: ${tier}`);
    console.log(`  Phases: founding=${foundingDom}, growth=${growthDom}, current=${currentDom}`);
    console.log(`  Stability: ${stability.toFixed(3)}`);
    console.log(`  Top elements: ${topElements}`);
    console.log();
  }

  console.log('All bots created and evolved!');
  await sql.end();
}

main().catch((err) => {
  console.error('Bot creation failed:', err);
  process.exit(1);
});
