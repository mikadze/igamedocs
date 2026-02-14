import { z } from 'zod';

/**
 * Zod schemas for inbound NATS command payloads.
 *
 * These are the source of truth for runtime validation (NatsEventSubscriber)
 * and are also used by the AsyncAPI spec sync guard to ensure the
 * asyncapi.yaml stays in sync with the actual validation logic.
 */

export const placeBetSchema = z.object({
  idempotencyKey: z.string().uuid(),
  playerId: z.string().min(1),
  roundId: z.string().min(1),
  amountCents: z.number().int().positive(),
  autoCashout: z.number().positive().optional(),
});

export const cashoutSchema = z.object({
  playerId: z.string().min(1),
  roundId: z.string().min(1),
  betId: z.string().min(1),
});
