import {
  pgTable,
  text,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';

export const gameConfig = pgTable('game_config', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type GameConfigEntry = typeof gameConfig.$inferSelect;
export type NewGameConfigEntry = typeof gameConfig.$inferInsert;
