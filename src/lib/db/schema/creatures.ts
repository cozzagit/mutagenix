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
};

export type VisualParams = Record<string, unknown>;

export const DEFAULT_ELEMENT_LEVELS: ElementLevels = {
  N: 0, K: 0, Na: 0, C: 0, O: 0, P: 0, S: 0, Ca: 0, Fe: 0, Cl: 0,
};

export const DEFAULT_TRAIT_VALUES: TraitValues = {
  bodySize: 0, headSize: 0, limbGrowth: 0, eyeDev: 0, skinTex: 0,
  furDensity: 0, spininess: 0, tailGrowth: 0, clawDev: 0, posture: 0,
  aggression: 0, luminosity: 0, toxicity: 0, intelligence: 0, armoring: 0,
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
  // Gradual mutation target state
  targetElementLevels: jsonb('target_element_levels').$type<ElementLevels>(),
  targetTraitValues: jsonb('target_trait_values').$type<TraitValues>(),
  targetVisualParams: jsonb('target_visual_params').$type<VisualParams>(),
  mutationStartedAt: timestamp('mutation_started_at', { withTimezone: true }),
  mutationEndsAt: timestamp('mutation_ends_at', { withTimezone: true }),

  // Archive fields
  isArchived: boolean('is_archived').default(false).notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archiveReason: text('archive_reason'), // 'reset' | 'failed' | null

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Creature = typeof creatures.$inferSelect;
export type NewCreature = typeof creatures.$inferInsert;
