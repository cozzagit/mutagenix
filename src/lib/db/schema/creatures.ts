import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  jsonb,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export type ElementLevels = {
  N: number;
  K: number;
  Na: number;
  C: number;
  O: number;
  P: number;
  S: number;
  Ca: number;
  Fe: number;
  Cl: number;
};

export type TraitValues = {
  bodySize: number;
  headSize: number;
  limbGrowth: number;
  eyeDev: number;
  skinTex: number;
  furDensity: number;
  spininess: number;
  tailGrowth: number;
  clawDev: number;
  posture: number;
  aggression: number;
  luminosity: number;
  toxicity: number;
  intelligence: number;
  armoring: number;
  mouthSize: number;
  // Combat traits (Warrior Phase)
  attackPower: number;
  defense: number;
  speed: number;
  stamina: number;
  specialAttack: number;
  battleScars: number;
};

export type VisualParams = Record<string, unknown>;

export const DEFAULT_ELEMENT_LEVELS: ElementLevels = {
  N: 0, K: 0, Na: 0, C: 0, O: 0, P: 0, S: 0, Ca: 0, Fe: 0, Cl: 0,
};

export const DEFAULT_TRAIT_VALUES: TraitValues = {
  bodySize: 0, headSize: 0, limbGrowth: 0, eyeDev: 0, skinTex: 0,
  furDensity: 0, spininess: 0, tailGrowth: 0, clawDev: 0, posture: 0,
  aggression: 0, luminosity: 0, toxicity: 0, intelligence: 0, armoring: 0,
  mouthSize: 0,
  // Combat traits
  attackPower: 0, defense: 0, speed: 0, stamina: 0, specialAttack: 0, battleScars: 0,
};

export const creatures = pgTable('creatures', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('Specimen-001'),
  generation: integer('generation').default(1),
  ageDays: integer('age_days').default(0),
  stability: real('stability').default(0.5),
  elementLevels: jsonb('element_levels')
    .$type<ElementLevels>()
    .notNull()
    .default(DEFAULT_ELEMENT_LEVELS),
  traitValues: jsonb('trait_values')
    .$type<TraitValues>()
    .notNull()
    .default(DEFAULT_TRAIT_VALUES),
  visualParams: jsonb('visual_params')
    .$type<VisualParams>()
    .notNull()
    .default({}),
  // Evolution path memory — phase snapshots (calculated once, stored permanently)
  foundingElements: jsonb('founding_elements').$type<Record<string, number>>(),  // sum of allocations days 1-15
  growthElements: jsonb('growth_elements').$type<Record<string, number>>(),      // sum of allocations days 16-40

  // Gradual mutation target state
  targetElementLevels: jsonb('target_element_levels').$type<ElementLevels>(),
  targetTraitValues: jsonb('target_trait_values').$type<TraitValues>(),
  targetVisualParams: jsonb('target_visual_params').$type<VisualParams>(),
  mutationStartedAt: timestamp('mutation_started_at', { withTimezone: true }),
  mutationEndsAt: timestamp('mutation_ends_at', { withTimezone: true }),

  // Breeding / lineage fields
  isFounder: boolean('is_founder').notNull().default(false),
  isDead: boolean('is_dead').notNull().default(false),
  deathAt: timestamp('death_at', { withTimezone: true }),
  deathCause: text('death_cause'), // starvation|instability|battle_trauma
  parentACreatureId: uuid('parent_a_creature_id'), // no FK to avoid circular deps
  parentBCreatureId: uuid('parent_b_creature_id'), // no FK to avoid circular deps
  familyGeneration: integer('family_generation').notNull().default(1),

  // Archive fields
  isArchived: boolean('is_archived').default(false).notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archiveReason: text('archive_reason'), // 'reset' | 'failed' | null

  // Clan traitor fields
  isTraitor: boolean('is_traitor').notNull().default(false),
  betrayedClanName: text('betrayed_clan_name'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Creature = typeof creatures.$inferSelect;
export type NewCreature = typeof creatures.$inferInsert;
