import { uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { gameSchema } from './common';
import { players } from './players';

export const playerSessions = gameSchema.table('player_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id')
    .references(() => players.id)
    .notNull(),
  operatorToken: varchar('operator_token', { length: 255 }).notNull(),
  platform: varchar('platform', { length: 32 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
