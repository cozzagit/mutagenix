import {
  pgTable,
  uuid,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { creatures } from './creatures';
import { users } from './users';

export const squads = pgTable('squads', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id)
    .unique(),
  slot1Id: uuid('slot1_id').references(() => creatures.id),
  slot2Id: uuid('slot2_id').references(() => creatures.id),
  slot3Id: uuid('slot3_id').references(() => creatures.id),
  reserve1Id: uuid('reserve1_id').references(() => creatures.id),
  reserve2Id: uuid('reserve2_id').references(() => creatures.id),
  reserve3Id: uuid('reserve3_id').references(() => creatures.id),
  autoRotate: boolean('auto_rotate').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Squad = typeof squads.$inferSelect;
export type NewSquad = typeof squads.$inferInsert;
