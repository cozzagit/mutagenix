import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { creatures } from './creatures';
import { users } from './users';

export const breedingRecords = pgTable('breeding_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAId: uuid('parent_a_id')
    .notNull()
    .references(() => creatures.id),
  parentBId: uuid('parent_b_id')
    .notNull()
    .references(() => creatures.id),
  playerAId: uuid('player_a_id')
    .notNull()
    .references(() => users.id),
  playerBId: uuid('player_b_id')
    .notNull()
    .references(() => users.id),
  offspringAId: uuid('offspring_a_id')
    .references(() => creatures.id),
  offspringBId: uuid('offspring_b_id')
    .references(() => creatures.id),
  energyCost: integer('energy_cost').notNull(),
  status: text('status').notNull().default('completed'),
  geneticsSeed: text('genetics_seed').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type BreedingRecord = typeof breedingRecords.$inferSelect;
export type NewBreedingRecord = typeof breedingRecords.$inferInsert;
