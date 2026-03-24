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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Clan = typeof clans.$inferSelect;
export type NewClan = typeof clans.$inferInsert;
