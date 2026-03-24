import {
  pgTable,
  uuid,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { creatures } from './creatures';
import { breedingRecords } from './breeding-records';

export const creatureLineage = pgTable('creature_lineage', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id')
    .notNull()
    .references(() => creatures.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id')
    .notNull()
    .references(() => creatures.id),
  parentRole: text('parent_role').notNull(), // primary|partner
  breedingId: uuid('breeding_id')
    .notNull()
    .references(() => breedingRecords.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('creature_lineage_child_role_unique').on(table.childId, table.parentRole),
]);

export type CreatureLineage = typeof creatureLineage.$inferSelect;
export type NewCreatureLineage = typeof creatureLineage.$inferInsert;
