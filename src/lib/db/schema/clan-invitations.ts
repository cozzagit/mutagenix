import {
  pgTable,
  uuid,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { clans } from './clans';
import { creatures } from './creatures';
import { users } from './users';

export const clanInvitations = pgTable('clan_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  clanId: uuid('clan_id')
    .notNull()
    .references(() => clans.id, { onDelete: 'cascade' }),
  creatureId: uuid('creature_id')
    .notNull()
    .references(() => creatures.id),
  inviterUserId: uuid('inviter_user_id')
    .notNull()
    .references(() => users.id),
  targetUserId: uuid('target_user_id')
    .notNull()
    .references(() => users.id),
  direction: text('direction').notNull().default('invite'), // invite|request
  status: text('status').notNull().default('pending'), // pending|accepted|rejected
  message: text('message'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ClanInvitation = typeof clanInvitations.$inferSelect;
export type NewClanInvitation = typeof clanInvitations.$inferInsert;
