import {
  uuid,
  varchar,
  decimal,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { gameSchema } from './common';
import { rounds } from './rounds';
import { operators } from './operators';
import { players } from './players';

export const walletTxTypeEnum = pgEnum('wallet_tx_type', [
  'BET',
  'WIN',
  'ROLLBACK',
]);

export const walletTxStatusEnum = pgEnum('wallet_tx_status', [
  'PENDING',
  'COMPLETED',
  'FAILED',
  'ROLLED_BACK',
]);

export const walletTransactions = gameSchema.table(
  'wallet_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id')
      .references(() => players.id)
      .notNull(),
    operatorId: uuid('operator_id')
      .references(() => operators.id)
      .notNull(),
    type: walletTxTypeEnum('type').notNull(),
    requestUuid: varchar('request_uuid', { length: 128 }).unique().notNull(),
    transactionUuid: varchar('transaction_uuid', { length: 128 })
      .unique()
      .notNull(),
    referenceTransactionUuid: varchar('ref_transaction_uuid', { length: 128 }),
    roundId: uuid('round_id')
      .references(() => rounds.id)
      .notNull(),
    amount: decimal('amount', { precision: 18, scale: 4 }).notNull(),
    currency: varchar('currency', { length: 8 }).notNull(),
    operatorResponse: jsonb('operator_response'),
    status: walletTxStatusEnum('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('wallet_tx_player_round_idx').on(table.playerId, table.roundId),
    index('wallet_tx_request_uuid_idx').on(table.requestUuid),
  ],
);
