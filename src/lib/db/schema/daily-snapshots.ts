import {
  pgTable,
  uuid,
  text,
  jsonb,
  real,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { creatures, type ElementLevels, type TraitValues, type VisualParams } from './creatures';

export type MutationRecord = {
  traitId: string;
  delta: number;
  trigger: string;
};

export const dailySnapshots = pgTable(
  'daily_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creatureId: uuid('creature_id')
      .notNull()
      .references(() => creatures.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    elementLevels: jsonb('element_levels').$type<ElementLevels>().notNull(),
    traitValues: jsonb('trait_values').$type<TraitValues>().notNull(),
    visualParams: jsonb('visual_params').$type<VisualParams>().notNull(),
    stabilityScore: real('stability_score').notNull(),
    mutationsApplied: jsonb('mutations_applied').$type<MutationRecord[]>().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('daily_snapshots_creature_day_unique').on(table.creatureId, table.day),
  ],
);

export type DailySnapshot = typeof dailySnapshots.$inferSelect;
export type NewDailySnapshot = typeof dailySnapshots.$inferInsert;
