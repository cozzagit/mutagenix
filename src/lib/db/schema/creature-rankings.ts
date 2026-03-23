import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { creatures } from './creatures';
import { users } from './users';

export const creatureRankings = pgTable('creature_rankings', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatureId: uuid('creature_id')
    .notNull()
    .references(() => creatures.id)
    .unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  eloRating: integer('elo_rating').notNull().default(1000),
  eloPeak: integer('elo_peak').notNull().default(1000),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  draws: integer('draws').notNull().default(0),
  winStreak: integer('win_streak').notNull().default(0),
  bestWinStreak: integer('best_win_streak').notNull().default(0),
  battlesToday: integer('battles_today').notNull().default(0),
  lastBattleAt: timestamp('last_battle_at', { withTimezone: true }),
  recoveryUntil: timestamp('recovery_until', { withTimezone: true }),
  traumaActive: boolean('trauma_active').notNull().default(false),
  consecutiveLosses: integer('consecutive_losses').notNull().default(0),
  axp: integer('axp').notNull().default(0),
  rankTier: text('rank_tier').notNull().default('novice'), // novice, intermediate, veteran, legend, immortal, divine
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type CreatureRanking = typeof creatureRankings.$inferSelect;
export type NewCreatureRanking = typeof creatureRankings.$inferInsert;
