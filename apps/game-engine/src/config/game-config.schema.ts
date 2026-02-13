import { z } from 'zod';

export const gameConfigSchema = z
  .object({
    HOUSE_EDGE_PERCENT: z.coerce
      .number()
      .min(0, 'HOUSE_EDGE_PERCENT must be >= 0')
      .max(100, 'HOUSE_EDGE_PERCENT must be <= 100'),

    MIN_BET_CENTS: z.coerce
      .number()
      .int()
      .positive('MIN_BET_CENTS must be > 0'),

    MAX_BET_CENTS: z.coerce
      .number()
      .int()
      .positive('MAX_BET_CENTS must be > 0'),

    BETTING_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive('BETTING_WINDOW_MS must be > 0'),

    TICK_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive('TICK_INTERVAL_MS must be > 0'),

    GROWTH_RATE: z.coerce.number().positive().optional(),
  })
  .refine((data) => data.MIN_BET_CENTS < data.MAX_BET_CENTS, {
    message: 'MIN_BET_CENTS must be less than MAX_BET_CENTS',
    path: ['MIN_BET_CENTS'],
  });

export type RawGameConfig = z.infer<typeof gameConfigSchema>;
