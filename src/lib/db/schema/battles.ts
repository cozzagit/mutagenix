import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';
import { creatures } from './creatures';
import { users } from './users';

export const battles = pgTable('battles', {
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
  battleType: text('battle_type').notNull(), // 'ranked' | 'direct' | 'tournament'
  winnerCreatureId: uuid('winner_creature_id'), // null = draw
  roundsPlayed: integer('rounds_played').notNull(),
  battleLog: jsonb('battle_log').notNull(), // array of round events
  challengerEloBefore: integer('challenger_elo_before').notNull(),
  defenderEloBefore: integer('defender_elo_before').notNull(),
  challengerEloAfter: integer('challenger_elo_after').notNull(),
  defenderEloAfter: integer('defender_elo_after').notNull(),
  challengerHpPercent: real('challenger_hp_percent'), // final HP %
  defenderHpPercent: real('defender_hp_percent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Battle = typeof battles.$inferSelect;
export type NewBattle = typeof battles.$inferInsert;
