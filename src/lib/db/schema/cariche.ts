import {
  pgTable,
  uuid,
  text,
  real,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { creatures } from './creatures';
import { users } from './users';

export const cariche = pgTable('cariche', {
  id: uuid('id').primaryKey().defaultRandom(),
  caricaId: text('carica_id').notNull(),
  creatureId: uuid('creature_id')
    .notNull()
    .references(() => creatures.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  metricValue: real('metric_value').notNull(),
  awardedAt: timestamp('awarded_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('cariche_carica_id_unique').on(table.caricaId),
]);

export const caricaHistory = pgTable('carica_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  caricaId: text('carica_id').notNull(),
  creatureId: uuid('creature_id')
    .notNull()
    .references(() => creatures.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  metricValue: real('metric_value').notNull(),
  weekStart: timestamp('week_start', { withTimezone: true }).notNull(),
  weekEnd: timestamp('week_end', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Carica = typeof cariche.$inferSelect;
export type NewCarica = typeof cariche.$inferInsert;
export type CaricaHistoryEntry = typeof caricaHistory.$inferSelect;
export type NewCaricaHistoryEntry = typeof caricaHistory.$inferInsert;
