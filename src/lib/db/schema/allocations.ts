import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { creatures } from './creatures';

export type AllocationCredits = Partial<Record<string, number>>;

export const allocations = pgTable(
  'allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creatureId: uuid('creature_id')
      .notNull()
      .references(() => creatures.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    credits: jsonb('credits').$type<AllocationCredits>().notNull(),
    totalCredits: integer('total_credits').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('allocations_creature_day_unique').on(table.creatureId, table.day),
  ],
);

export type Allocation = typeof allocations.$inferSelect;
export type NewAllocation = typeof allocations.$inferInsert;
