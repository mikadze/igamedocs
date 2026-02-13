import { uuid, varchar, decimal, timestamp } from 'drizzle-orm/pg-core';
import { gameSchema } from './common';
import { rounds } from './rounds';

export const seedAuditLogs = gameSchema.table('seed_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  roundId: uuid('round_id')
    .references(() => rounds.id)
    .unique()
    .notNull(),
  serverSeed: varchar('server_seed', { length: 128 }).notNull(),
  serverSeedHash: varchar('server_seed_hash', { length: 128 }).notNull(),
  clientSeed: varchar('client_seed', { length: 128 }),
  combinedHash: varchar('combined_hash', { length: 256 }),
  derivedCrashPoint: decimal('derived_crash_point', {
    precision: 10,
    scale: 4,
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
