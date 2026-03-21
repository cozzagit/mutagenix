import {
  pgTable,
  uuid,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { creatures } from './creatures';
import { users } from './users';
import { battles } from './battles';

export const battleChallenges = pgTable('battle_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  challengerCreatureId: uuid('challenger_creature_id')
    .notNull()
    .references(() => creatures.id),
  defenderCreatureId: uuid('defender_creature_id')
    .notNull()
    .references(() => creatures.id),
  challengerUserId: uuid('challenger_user_id')
    .notNull()
    .references(() => users.id),
  defenderUserId: uuid('defender_user_id')
    .notNull()
    .references(() => users.id),
  status: text('status').notNull().default('pending'), // pending, accepted, expired, cancelled
  battleId: uuid('battle_id').references(() => battles.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type BattleChallenge = typeof battleChallenges.$inferSelect;
export type NewBattleChallenge = typeof battleChallenges.$inferInsert;
