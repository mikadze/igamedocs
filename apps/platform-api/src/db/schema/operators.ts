import {
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { gameSchema } from './common';

export const operators = gameSchema.table('operators', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 128 }).notNull(),
  code: varchar('code', { length: 64 }).unique().notNull(),
  rsaPublicKey: text('rsa_public_key').notNull(),
  aviatrixPrivateKeyId: varchar('aviatrix_private_key_id', { length: 64 }),
  walletBaseUrl: varchar('wallet_base_url', { length: 512 }).notNull(),
  walletApiVersion: varchar('wallet_api_version', { length: 16 }).default('v1'),
  callbackUrl: varchar('callback_url', { length: 512 }),
  allowedIps: jsonb('allowed_ips').$type<string[]>().default([]),
  currencies: jsonb('currencies').$type<string[]>().default([]),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
