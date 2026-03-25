import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
} from 'drizzle-orm/pg-core';
import { clanWars } from './clan-wars';
import { creatures } from './creatures';
import { battles } from './battles';

export const clanWarMatches = pgTable('clan_war_matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  clanWarId: uuid('clan_war_id')
    .notNull()
    .references(() => clanWars.id, { onDelete: 'cascade' }),
  matchIndex: integer('match_index').notNull(),
  creature1Id: uuid('creature_1_id')
    .notNull()
    .references(() => creatures.id),
  creature2Id: uuid('creature_2_id')
    .notNull()
    .references(() => creatures.id),
  battleId: uuid('battle_id')
    .references(() => battles.id),
  winnerCreatureId: uuid('winner_creature_id'),
  status: text('status').notNull().default('pending'), // pending|completed
  hpPercent1: real('hp_percent_1'),
  hpPercent2: real('hp_percent_2'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ClanWarMatch = typeof clanWarMatches.$inferSelect;
export type NewClanWarMatch = typeof clanWarMatches.$inferInsert;
