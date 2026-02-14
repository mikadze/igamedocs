import { describe, it, expect } from 'vitest';
import {
  roundNewSchema,
  roundBettingSchema,
  roundStartedSchema,
  roundCrashedSchema,
  tickSchema,
  betPlacedSchema,
  betWonSchema,
  betLostSchema,
  betRejectedSchema,
  creditFailedSchema,
} from '@messaging/infrastructure/nats-schemas';

describe('NATS event payload schemas', () => {
  describe('roundNewSchema', () => {
    it('accepts valid payload', () => {
      const result = roundNewSchema.safeParse({ roundId: 'r1', hashedSeed: 'abc123' });
      expect(result.success).toBe(true);
    });

    it('rejects missing roundId', () => {
      const result = roundNewSchema.safeParse({ hashedSeed: 'abc123' });
      expect(result.success).toBe(false);
    });

    it('rejects empty roundId', () => {
      const result = roundNewSchema.safeParse({ roundId: '', hashedSeed: 'abc123' });
      expect(result.success).toBe(false);
    });
  });

  describe('roundBettingSchema', () => {
    it('accepts valid payload', () => {
      const result = roundBettingSchema.safeParse({ roundId: 'r1', endsAt: 1700000000000 });
      expect(result.success).toBe(true);
    });

    it('rejects missing endsAt', () => {
      const result = roundBettingSchema.safeParse({ roundId: 'r1' });
      expect(result.success).toBe(false);
    });

    it('rejects negative endsAt', () => {
      const result = roundBettingSchema.safeParse({ roundId: 'r1', endsAt: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects zero endsAt', () => {
      const result = roundBettingSchema.safeParse({ roundId: 'r1', endsAt: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe('roundStartedSchema', () => {
    it('accepts valid payload', () => {
      const result = roundStartedSchema.safeParse({ roundId: 'r1' });
      expect(result.success).toBe(true);
    });

    it('rejects missing roundId', () => {
      const result = roundStartedSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('roundCrashedSchema', () => {
    it('accepts valid payload', () => {
      const result = roundCrashedSchema.safeParse({
        roundId: 'r1',
        crashPoint: 2.5,
        serverSeed: 'seed123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-positive crashPoint', () => {
      const result = roundCrashedSchema.safeParse({
        roundId: 'r1',
        crashPoint: 0,
        serverSeed: 'seed123',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing serverSeed', () => {
      const result = roundCrashedSchema.safeParse({
        roundId: 'r1',
        crashPoint: 2.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('tickSchema', () => {
    it('accepts valid payload', () => {
      const result = tickSchema.safeParse({
        roundId: 'r1',
        multiplier: 1.5,
        elapsedMs: 500,
      });
      expect(result.success).toBe(true);
    });

    it('accepts zero elapsedMs', () => {
      const result = tickSchema.safeParse({
        roundId: 'r1',
        multiplier: 1.0,
        elapsedMs: 0,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative multiplier', () => {
      const result = tickSchema.safeParse({
        roundId: 'r1',
        multiplier: -1,
        elapsedMs: 500,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('betPlacedSchema', () => {
    it('accepts full BetSnapshot payload', () => {
      const result = betPlacedSchema.safeParse({
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        status: 'ACTIVE',
        cashoutMultiplier: undefined,
        payoutCents: undefined,
      });
      expect(result.success).toBe(true);
    });

    it('accepts payload with optional fields present', () => {
      const result = betPlacedSchema.safeParse({
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        status: 'ACTIVE',
        cashoutMultiplier: 2.0,
        payoutCents: 1000,
      });
      expect(result.success).toBe(true);
    });

    it('accepts payload without optional fields', () => {
      const result = betPlacedSchema.safeParse({
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        status: 'PENDING',
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-positive amountCents', () => {
      const result = betPlacedSchema.safeParse({
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 0,
        status: 'ACTIVE',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer amountCents', () => {
      const result = betPlacedSchema.safeParse({
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 10.5,
        status: 'ACTIVE',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('betWonSchema', () => {
    it('accepts valid payload', () => {
      const result = betWonSchema.safeParse({
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        status: 'WON',
        cashoutMultiplier: 2.5,
        payoutCents: 1250,
      });
      expect(result.success).toBe(true);
    });

    it('requires cashoutMultiplier', () => {
      const result = betWonSchema.safeParse({
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        status: 'WON',
        payoutCents: 1250,
      });
      expect(result.success).toBe(false);
    });

    it('requires payoutCents', () => {
      const result = betWonSchema.safeParse({
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        status: 'WON',
        cashoutMultiplier: 2.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('betLostSchema', () => {
    it('accepts valid payload with crashPoint', () => {
      const result = betLostSchema.safeParse({
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        status: 'LOST',
        crashPoint: 1.5,
      });
      expect(result.success).toBe(true);
    });

    it('accepts payload with optional BetSnapshot fields', () => {
      const result = betLostSchema.safeParse({
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        status: 'LOST',
        cashoutMultiplier: undefined,
        payoutCents: undefined,
        crashPoint: 1.5,
      });
      expect(result.success).toBe(true);
    });

    it('requires crashPoint', () => {
      const result = betLostSchema.safeParse({
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        status: 'LOST',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-positive crashPoint', () => {
      const result = betLostSchema.safeParse({
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        status: 'LOST',
        crashPoint: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('betRejectedSchema', () => {
    it('accepts valid payload', () => {
      const result = betRejectedSchema.safeParse({
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        error: 'ROUND_NOT_BETTING',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing error', () => {
      const result = betRejectedSchema.safeParse({
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('creditFailedSchema', () => {
    it('accepts valid payload', () => {
      const result = creditFailedSchema.safeParse({
        playerId: 'p1',
        betId: 'b1',
        roundId: 'r1',
        payoutCents: 5000,
        reason: 'TIMEOUT',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing reason', () => {
      const result = creditFailedSchema.safeParse({
        playerId: 'p1',
        betId: 'b1',
        roundId: 'r1',
        payoutCents: 5000,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-positive payoutCents', () => {
      const result = creditFailedSchema.safeParse({
        playerId: 'p1',
        betId: 'b1',
        roundId: 'r1',
        payoutCents: 0,
        reason: 'TIMEOUT',
      });
      expect(result.success).toBe(false);
    });
  });
});
