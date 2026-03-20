import {
  pgTable,
  uuid,
  text,
  real,
  timestamp,
} from 'drizzle-orm/pg-core';
import { creatures } from './creatures';

export const TRIGGER_TYPES = [
  'element',
  'synergy',
  'decay',
  'threshold',
  'noise',
] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const mutationLog = pgTable('mutation_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatureId: uuid('creature_id')
    .notNull()
    .references(() => creatures.id, { onDelete: 'cascade' }),
  day: text('day').notNull(),
  traitId: text('trait_id').notNull(),
  oldValue: real('old_value').notNull(),
  newValue: real('new_value').notNull(),
  delta: real('delta').notNull(),
  triggerType: text('trigger_type').$type<TriggerType>().notNull(),
  triggerDetails: text('trigger_details'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type MutationLogEntry = typeof mutationLog.$inferSelect;
export type NewMutationLogEntry = typeof mutationLog.$inferInsert;
