import { uuid, varchar, timestamp, unique } from 'drizzle-orm/pg-core';
import { gameSchema } from './common';
import { operators } from './operators';

export const players = gameSchema.table(
  'players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    operatorId: uuid('operator_id')
      .references(() => operators.id)
      .notNull(),
    operatorPlayerId: varchar('operator_player_id', { length: 128 }).notNull(),
    currency: varchar('currency', { length: 8 }).notNull(),
    country: varchar('country', { length: 4 }),
    language: varchar('language', { length: 8 }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('players_operator_player_unique').on(
      table.operatorId,
      table.operatorPlayerId,
    ),
  ],
);
