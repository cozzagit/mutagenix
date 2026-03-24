import {
  pgTable,
  uuid,
  integer,
  real,
  jsonb,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { tournaments } from './tournaments';
import { tournamentParticipants } from './tournament-participants';

export const tournamentResults = pgTable(
  'tournament_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => tournamentParticipants.id),
    finalRank: integer('final_rank').notNull(),
    finalPoints: integer('final_points').notNull().default(0),
    totalDamageTaken: real('total_damage_taken').notNull().default(0),
    creatureDeaths: jsonb('creature_deaths').default([]),
    prizesAwarded: jsonb('prizes_awarded').default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('tournament_results_tournament_participant_unique').on(
      table.tournamentId,
      table.participantId,
    ),
  ],
);

export type TournamentResult = typeof tournamentResults.$inferSelect;
export type NewTournamentResult = typeof tournamentResults.$inferInsert;
