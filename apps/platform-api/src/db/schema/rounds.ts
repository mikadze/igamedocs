import {
  uuid,
  decimal,
  integer,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { gameSchema } from './common';
import { operators } from './operators';

export const roundStatusEnum = pgEnum('round_status', [
  'WAITING',
  'BETTING',
  'FLYING',
  'CRASHED',
  'SETTLED',
]);

export const rounds = gameSchema.table(
  'rounds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    operatorId: uuid('operator_id')
      .references(() => operators.id)
      .notNull(),
    status: roundStatusEnum('status').default('WAITING').notNull(),
    crashPoint: decimal('crash_point', { precision: 10, scale: 4 }),
    bettingWindowMs: integer('betting_window_ms').default(10000).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    crashedAt: timestamp('crashed_at', { withTimezone: true }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('rounds_operator_created_idx').on(table.operatorId, table.createdAt),
  ],
);
