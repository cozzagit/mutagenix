import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { creatures } from './creatures';
import { users } from './users';

export const clans = pgTable('clans', {
  id: uuid('id').primaryKey().defaultRandom(),
  founderId: uuid('founder_id')
    .notNull()
    .references(() => creatures.id)
    .unique(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  name: text('name').notNull(),
  motto: text('motto'),
  clanType: text('clan_type').notNull().default('open'), // closed|open
  totalMembers: integer('total_members').notNull().default(1),
  totalGenerations: integer('total_generations').notNull().default(1),
  // Clan system v2 columns
  clanElo: integer('clan_elo').notNull().default(1000),
  clanEloPeak: integer('clan_elo_peak').notNull().default(1000),
  prestige: integer('prestige').notNull().default(0),
  emblemColor: text('emblem_color'),
  status: text('status').notNull().default('forming'), // forming|active|disbanded
  clanWins: integer('clan_wins').notNull().default(0),
  clanLosses: integer('clan_losses').notNull().default(0),
  maxMembers: integer('max_members').notNull().default(15),
  energyVault: integer('energy_vault').notNull().default(0),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Clan = typeof clans.$inferSelect;
export type NewClan = typeof clans.$inferInsert;
