import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const tournaments = pgTable('tournaments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  tournamentType: text('tournament_type').notNull().default('knockout'),
  status: text('status').notNull().default('draft'),
  battleFormat: text('battle_format').notNull().default('3v3'),
  maxParticipants: integer('max_participants'),
  minParticipants: integer('min_participants').notNull().default(4),
  entryFee: integer('entry_fee').notNull().default(0),
  rules: jsonb('rules').default({}),
  prizes: jsonb('prizes').default([]),
  schedule: jsonb('schedule').default({}),
  currentRound: integer('current_round').notNull().default(0),
  totalRounds: integer('total_rounds'),
  enrollmentStart: timestamp('enrollment_start', { withTimezone: true }),
  enrollmentEnd: timestamp('enrollment_end', { withTimezone: true }),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
