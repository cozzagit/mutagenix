import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';
import { tournaments } from './tournaments';
import { tournamentParticipants } from './tournament-participants';

export const tournamentMatches = pgTable('tournament_matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournaments.id, { onDelete: 'cascade' }),
  roundNumber: integer('round_number').notNull(),
  participant1Id: uuid('participant1_id')
    .notNull()
    .references(() => tournamentParticipants.id),
  participant2Id: uuid('participant2_id')
    .notNull()
    .references(() => tournamentParticipants.id),
  matchFormat: text('match_format').notNull().default('3v3'),
  status: text('status').notNull().default('pending'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  winnerId: uuid('winner_id').references(() => tournamentParticipants.id),
  duelResults: jsonb('duel_results'),
  participant1Damage: jsonb('participant1_damage'),
  participant2Damage: jsonb('participant2_damage'),
  kinshipData: jsonb('kinship_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type TournamentMatch = typeof tournamentMatches.$inferSelect;
export type NewTournamentMatch = typeof tournamentMatches.$inferInsert;
