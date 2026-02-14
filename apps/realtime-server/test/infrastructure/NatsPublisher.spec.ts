import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NatsPublisher } from '@messaging/infrastructure/NatsPublisher';
import type { GameTopics } from '@messaging/infrastructure/topics';
import type { Logger } from '@shared/ports/Logger';

function createMockNats() {
  return { publish: vi.fn() };
}

function createMockLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const topics: GameTopics = Object.freeze({
  ROUND_NEW: 'game.test-op.round.new',
  ROUND_BETTING: 'game.test-op.round.betting',
  ROUND_STARTED: 'game.test-op.round.started',
  ROUND_CRASHED: 'game.test-op.round.crashed',
  TICK: 'game.test-op.tick',
  BET_PLACED: 'game.test-op.bet.placed',
  BET_WON: 'game.test-op.bet.won',
  BET_LOST: 'game.test-op.bet.lost',
  BET_REJECTED: 'game.test-op.bet.rejected',
  CREDIT_FAILED: 'game.test-op.credit.failed',
  CMD_PLACE_BET: 'game.test-op.cmd.place-bet',
  CMD_CASHOUT: 'game.test-op.cmd.cashout',
});

describe('NatsPublisher', () => {
  let nats: ReturnType<typeof createMockNats>;
  let logger: Logger;
  let publisher: NatsPublisher;

  beforeEach(() => {
    nats = createMockNats();
    logger = createMockLogger();
    publisher = new NatsPublisher(nats as any, topics, logger);
  });

  describe('publishPlaceBet', () => {
    it('publishes to CMD_PLACE_BET topic with JSON payload', () => {
      const payload = {
        idempotencyKey: 'key-1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        autoCashout: 2.5,
      };

      const result = publisher.publishPlaceBet(payload);

      expect(result).toBe(true);
      expect(nats.publish).toHaveBeenCalledOnce();
      const [subject, data] = nats.publish.mock.calls[0];
      expect(subject).toBe('game.test-op.cmd.place-bet');

      const decoded = JSON.parse(new TextDecoder().decode(data));
      expect(decoded).toEqual(payload);
    });

    it('publishes without optional autoCashout', () => {
      const payload = {
        idempotencyKey: 'key-2',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 100,
      };

      publisher.publishPlaceBet(payload);

      const [, data] = nats.publish.mock.calls[0];
      const decoded = JSON.parse(new TextDecoder().decode(data));
      expect(decoded.autoCashout).toBeUndefined();
    });
  });

  describe('publishCashout', () => {
    it('publishes to CMD_CASHOUT topic with JSON payload', () => {
      const payload = { playerId: 'p1', roundId: 'r1', betId: 'b1' };

      const result = publisher.publishCashout(payload);

      expect(result).toBe(true);
      expect(nats.publish).toHaveBeenCalledOnce();
      const [subject, data] = nats.publish.mock.calls[0];
      expect(subject).toBe('game.test-op.cmd.cashout');

      const decoded = JSON.parse(new TextDecoder().decode(data));
      expect(decoded).toEqual(payload);
    });
  });

  describe('error resilience', () => {
    it('returns false and logs error when publish fails', () => {
      nats.publish.mockImplementation(() => {
        throw new Error('NATS down');
      });

      const result = publisher.publishPlaceBet({
        idempotencyKey: 'key-1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 100,
      });

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('NATS publish failed', {
        subject: 'game.test-op.cmd.place-bet',
        error: 'NATS down',
      });
    });

    it('handles non-Error thrown values and returns false', () => {
      nats.publish.mockImplementation(() => {
        throw 'string error';
      });

      const result = publisher.publishCashout({ playerId: 'p1', roundId: 'r1', betId: 'b1' });

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('NATS publish failed', {
        subject: 'game.test-op.cmd.cashout',
        error: 'string error',
      });
    });
  });
});
