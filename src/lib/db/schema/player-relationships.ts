import {
  pgTable,
  uuid,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const playerRelationships = pgTable('player_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerAId: uuid('player_a_id')
    .notNull()
    .references(() => users.id),
  playerBId: uuid('player_b_id')
    .notNull()
    .references(() => users.id),
  totalBreedings: integer('total_breedings').notNull().default(0),
  relationshipScore: integer('relationship_score').notNull().default(0),
  lastBreedingAt: timestamp('last_breeding_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type PlayerRelationship = typeof playerRelationships.$inferSelect;
export type NewPlayerRelationship = typeof playerRelationships.$inferInsert;
