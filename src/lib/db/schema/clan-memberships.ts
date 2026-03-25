import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { clans } from './clans';
import { creatures } from './creatures';
import { users } from './users';

export const clanMemberships = pgTable('clan_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  clanId: uuid('clan_id')
    .notNull()
    .references(() => clans.id, { onDelete: 'cascade' }),
  creatureId: uuid('creature_id')
    .notNull()
    .references(() => creatures.id)
    .unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  role: text('role').notNull().default('soldato'), // boss|luogotenente|soldato
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  // Clan system v2 columns
  isTraitor: boolean('is_traitor').notNull().default(false),
  contributionScore: integer('contribution_score').notNull().default(0),
  vulnerabilityUntil: timestamp('vulnerability_until', { withTimezone: true }),
});

export type ClanMembership = typeof clanMemberships.$inferSelect;
export type NewClanMembership = typeof clanMemberships.$inferInsert;
