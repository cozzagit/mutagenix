import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { creatures } from './creatures';

export const breedingRequests = pgTable('breeding_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  requesterId: uuid('requester_id')
    .notNull()
    .references(() => users.id),
  targetId: uuid('target_id')
    .notNull()
    .references(() => users.id),
  requesterCreatureId: uuid('requester_creature_id')
    .notNull()
    .references(() => creatures.id),
  targetCreatureId: uuid('target_creature_id')
    .notNull()
    .references(() => creatures.id),
  status: text('status').notNull().default('pending'), // pending|accepted|rejected|expired|cancelled
  message: text('message'),
  energyCost: integer('energy_cost').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type BreedingRequest = typeof breedingRequests.$inferSelect;
export type NewBreedingRequest = typeof breedingRequests.$inferInsert;
