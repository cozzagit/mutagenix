import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';
import { clans } from './clans';

export const clanWars = pgTable('clan_wars', {
  id: uuid('id').primaryKey().defaultRandom(),
  challengerClanId: uuid('challenger_clan_id')
    .notNull()
    .references(() => clans.id),
  defenderClanId: uuid('defender_clan_id')
    .notNull()
    .references(() => clans.id),
  warType: text('war_type').notNull().default('sfida'), // sfida|territorio
  format: text('format').notNull().default('bo5'), // bo3|bo5|bo7
  status: text('status').notNull().default('pending'), // pending|accepted|in_progress|completed|declined
  winnerClanId: uuid('winner_clan_id'),
  challengerEloBefore: integer('challenger_elo_before').notNull(),
  defenderEloBefore: integer('defender_elo_before').notNull(),
  challengerEloAfter: integer('challenger_elo_after'),
  defenderEloAfter: integer('defender_elo_after'),
  prestigeStakes: integer('prestige_stakes').notNull().default(50),
  challengerRoster: jsonb('challenger_roster').$type<string[]>(), // array of creature IDs
  defenderRoster: jsonb('defender_roster').$type<string[]>(), // array of creature IDs
  challengerWins: integer('challenger_wins').notNull().default(0),
  defenderWins: integer('defender_wins').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ClanWar = typeof clanWars.$inferSelect;
export type NewClanWar = typeof clanWars.$inferInsert;
