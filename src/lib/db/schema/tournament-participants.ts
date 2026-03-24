import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { tournaments } from './tournaments';
import { users } from './users';

export const tournamentParticipants = pgTable(
  'tournament_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    squadSnapshot: jsonb('squad_snapshot').notNull(),
    accumulatedDamage: jsonb('accumulated_damage').default({}),
    matchesPlayed: integer('matches_played').notNull().default(0),
    matchesWon: integer('matches_won').notNull().default(0),
    matchesLost: integer('matches_lost').notNull().default(0),
    matchesDrawn: integer('matches_drawn').notNull().default(0),
    points: integer('points').notNull().default(0),
    isEliminated: boolean('is_eliminated').notNull().default(false),
    seed: integer('seed'),
    status: text('status').notNull().default('active'),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('tournament_participants_tournament_user_unique').on(
      table.tournamentId,
      table.userId,
    ),
  ],
);

export type TournamentParticipant = typeof tournamentParticipants.$inferSelect;
export type NewTournamentParticipant = typeof tournamentParticipants.$inferInsert;
