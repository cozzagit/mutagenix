import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash'),
  displayName: text('display_name').notNull(),
  streak: integer('streak').default(0),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  isAdmin: boolean('is_admin').default(false),
  activeCreatureId: uuid('active_creature_id'), // no FK to avoid circular deps
  energy: integer('energy').notNull().default(100),
  maxCreatures: integer('max_creatures').notNull().default(1),
  lastArenaVisit: timestamp('last_arena_visit', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
