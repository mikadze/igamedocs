import {
  uuid,
  varchar,
  decimal,
  timestamp,
  pgEnum,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { gameSchema } from './common';
import { rounds } from './rounds';
import { operators } from './operators';

export const betStatusEnum = pgEnum('bet_status', [
  'PENDING',
  'WON',
  'LOST',
]);

export const bets = gameSchema.table(
  'bets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roundId: uuid('round_id')
      .references(() => rounds.id)
      .notNull(),
    operatorId: uuid('operator_id')
      .references(() => operators.id)
      .notNull(),
    operatorPlayerId: varchar('operator_player_id', { length: 128 }).notNull(),
    amount: decimal('amount', { precision: 18, scale: 4 }).notNull(),
    autoCashoutAt: decimal('auto_cashout_at', { precision: 10, scale: 4 }),
    cashoutMultiplier: decimal('cashout_multiplier', {
      precision: 10,
      scale: 4,
    }),
    payout: decimal('payout', { precision: 18, scale: 4 }),
    status: betStatusEnum('status').default('PENDING').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('bets_round_player_unique').on(
      table.roundId,
      table.operatorPlayerId,
    ),
    index('bets_round_id_idx').on(table.roundId),
    index('bets_operator_player_id_idx').on(table.operatorPlayerId),
    index('bets_operator_player_created_idx').on(
      table.operatorPlayerId,
      table.createdAt,
    ),
  ],
);
