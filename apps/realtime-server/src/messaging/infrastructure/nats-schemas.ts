import { z } from 'zod';

/**
 * Zod schemas for inbound NATS event payloads.
 *
 * These validate the JSON messages published by the game engine's
 * NatsEventPublisher. Bet events include the full BetSnapshot shape
 * (with `status`, optional `cashoutMultiplier`/`payoutCents`) even
 * though the realtime-server's domain ServerMessage uses only a
 * subset of fields. The mapping happens in the subscriber wiring.
 */

// ── Round lifecycle events ──────────────────────────────────────

export const roundNewSchema = z.object({
  roundId: z.string().min(1),
  hashedSeed: z.string().min(1),
});

export const roundBettingSchema = z.object({
  roundId: z.string().min(1),
  endsAt: z.number().positive(),
});

export const roundStartedSchema = z.object({
  roundId: z.string().min(1),
});

export const roundCrashedSchema = z.object({
  roundId: z.string().min(1),
  crashPoint: z.number().positive(),
  serverSeed: z.string().min(1),
});

export const tickSchema = z.object({
  roundId: z.string().min(1),
  multiplier: z.number().positive(),
  elapsedMs: z.number().nonnegative(),
});

// ── Bet events (published as full BetSnapshot + extras) ─────────

export const betPlacedSchema = z.object({
  betId: z.string().min(1),
  playerId: z.string().min(1),
  roundId: z.string().min(1),
  amountCents: z.number().int().positive(),
  status: z.string(),
  cashoutMultiplier: z.number().optional(),
  payoutCents: z.number().optional(),
});

export const betWonSchema = z.object({
  betId: z.string().min(1),
  playerId: z.string().min(1),
  roundId: z.string().min(1),
  amountCents: z.number().int().positive(),
  status: z.string(),
  cashoutMultiplier: z.number(),
  payoutCents: z.number().int().positive(),
});

// betLost is { ...BetSnapshot, crashPoint } (spread by NatsEventPublisher)
export const betLostSchema = z.object({
  betId: z.string().min(1),
  playerId: z.string().min(1),
  roundId: z.string().min(1),
  amountCents: z.number().int().positive(),
  status: z.string(),
  cashoutMultiplier: z.number().optional(),
  payoutCents: z.number().optional(),
  crashPoint: z.number().positive(),
});

// ── Player-specific events (not BetSnapshot-based) ──────────────

export const betRejectedSchema = z.object({
  playerId: z.string().min(1),
  roundId: z.string().min(1),
  amountCents: z.number().int().positive(),
  error: z.string().min(1),
});

export const creditFailedSchema = z.object({
  playerId: z.string().min(1),
  betId: z.string().min(1),
  roundId: z.string().min(1),
  payoutCents: z.number().int().positive(),
  reason: z.string().min(1),
});
