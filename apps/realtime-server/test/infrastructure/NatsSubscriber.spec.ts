import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NatsSubscriber } from '@messaging/infrastructure/NatsSubscriber';
import type { GameTopics } from '@messaging/infrastructure/topics';
import type { Logger } from '@shared/ports/Logger';

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

function createMockLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

interface CapturedSubscription {
  subject: string;
  callback: (err: Error | null, msg: { json: () => unknown }) => void;
  drain: ReturnType<typeof vi.fn>;
}

function createMockNats() {
  const subscriptions: CapturedSubscription[] = [];
  return {
    subscriptions,
    subscribe: vi.fn((subject: string, opts: { callback: (err: Error | null, msg: any) => void }) => {
      const sub = { subject, callback: opts.callback, drain: vi.fn(async () => {}) };
      subscriptions.push(sub);
      return sub;
    }),
  };
}

function makeMsg(payload: unknown) {
  return { json: () => payload };
}

describe('NatsSubscriber', () => {
  let nats: ReturnType<typeof createMockNats>;
  let logger: Logger;
  let subscriber: NatsSubscriber;

  beforeEach(() => {
    nats = createMockNats();
    logger = createMockLogger();
    subscriber = new NatsSubscriber(nats as any, topics, logger);
  });

  describe('onRoundNew', () => {
    it('subscribes to the correct topic', () => {
      subscriber.onRoundNew(vi.fn());
      expect(nats.subscribe).toHaveBeenCalledWith('game.test-op.round.new', expect.any(Object));
    });

    it('invokes handler with valid payload', () => {
      const handler = vi.fn();
      subscriber.onRoundNew(handler);

      const sub = nats.subscriptions[0];
      sub.callback(null, makeMsg({ roundId: 'r1', hashedSeed: 'hash123' }));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ roundId: 'r1', hashedSeed: 'hash123' }),
      );
    });

    it('logs and drops invalid payload', () => {
      const handler = vi.fn();
      subscriber.onRoundNew(handler);

      const sub = nats.subscriptions[0];
      sub.callback(null, makeMsg({ roundId: '' }));

      expect(handler).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Invalid NATS event payload', expect.any(Object));
    });

    it('logs NATS subscription error', () => {
      const handler = vi.fn();
      subscriber.onRoundNew(handler);

      const sub = nats.subscriptions[0];
      sub.callback(new Error('NATS error'), makeMsg({}));

      expect(handler).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('NATS subscription error', {
        subject: 'game.test-op.round.new',
        error: 'NATS error',
      });
    });
  });

  describe('onTick', () => {
    it('invokes handler with valid tick payload', () => {
      const handler = vi.fn();
      subscriber.onTick(handler);

      const sub = nats.subscriptions[0];
      sub.callback(null, makeMsg({ roundId: 'r1', multiplier: 1.5, elapsedMs: 500 }));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ roundId: 'r1', multiplier: 1.5, elapsedMs: 500 }),
      );
    });

    it('rejects negative multiplier', () => {
      const handler = vi.fn();
      subscriber.onTick(handler);

      const sub = nats.subscriptions[0];
      sub.callback(null, makeMsg({ roundId: 'r1', multiplier: -1, elapsedMs: 500 }));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('onBetPlaced', () => {
    it('invokes handler with full BetSnapshot payload', () => {
      const handler = vi.fn();
      subscriber.onBetPlaced(handler);

      const sub = nats.subscriptions[0];
      sub.callback(null, makeMsg({
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        status: 'ACTIVE',
        cashoutMultiplier: undefined,
        payoutCents: undefined,
      }));

      expect(handler).toHaveBeenCalledOnce();
      const data = handler.mock.calls[0][0];
      expect(data.betId).toBe('b1');
      expect(data.amountCents).toBe(500);
    });
  });

  describe('onBetWon', () => {
    it('invokes handler with valid payload', () => {
      const handler = vi.fn();
      subscriber.onBetWon(handler);

      const sub = nats.subscriptions[0];
      sub.callback(null, makeMsg({
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        status: 'WON',
        cashoutMultiplier: 2.5,
        payoutCents: 1250,
      }));

      expect(handler).toHaveBeenCalledOnce();
      const data = handler.mock.calls[0][0];
      expect(data.cashoutMultiplier).toBe(2.5);
      expect(data.payoutCents).toBe(1250);
    });

    it('rejects missing cashoutMultiplier', () => {
      const handler = vi.fn();
      subscriber.onBetWon(handler);

      const sub = nats.subscriptions[0];
      sub.callback(null, makeMsg({
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        status: 'WON',
        payoutCents: 1250,
      }));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('onBetLost', () => {
    it('invokes handler with BetSnapshot + crashPoint', () => {
      const handler = vi.fn();
      subscriber.onBetLost(handler);

      const sub = nats.subscriptions[0];
      sub.callback(null, makeMsg({
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        status: 'LOST',
        crashPoint: 1.5,
      }));

      expect(handler).toHaveBeenCalledOnce();
      const data = handler.mock.calls[0][0];
      expect(data.crashPoint).toBe(1.5);
    });
  });

  describe('onBetRejected', () => {
    it('invokes handler with valid payload', () => {
      const handler = vi.fn();
      subscriber.onBetRejected(handler);

      const sub = nats.subscriptions[0];
      sub.callback(null, makeMsg({
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 500,
        error: 'ROUND_NOT_BETTING',
      }));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'ROUND_NOT_BETTING' }),
      );
    });
  });

  describe('onCreditFailed', () => {
    it('invokes handler with valid payload', () => {
      const handler = vi.fn();
      subscriber.onCreditFailed(handler);

      const sub = nats.subscriptions[0];
      sub.callback(null, makeMsg({
        playerId: 'p1',
        betId: 'b1',
        roundId: 'r1',
        payoutCents: 5000,
        reason: 'TIMEOUT',
      }));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'TIMEOUT', payoutCents: 5000 }),
      );
    });
  });

  describe('onRoundBetting', () => {
    it('invokes handler with valid payload', () => {
      const handler = vi.fn();
      subscriber.onRoundBetting(handler);

      const sub = nats.subscriptions[0];
      sub.callback(null, makeMsg({ roundId: 'r1', endsAt: 1700000000000 }));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ roundId: 'r1', endsAt: 1700000000000 }),
      );
    });
  });

  describe('onRoundStarted', () => {
    it('invokes handler with valid payload', () => {
      const handler = vi.fn();
      subscriber.onRoundStarted(handler);

      const sub = nats.subscriptions[0];
      sub.callback(null, makeMsg({ roundId: 'r1' }));

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ roundId: 'r1' }));
    });
  });

  describe('onRoundCrashed', () => {
    it('invokes handler with valid payload', () => {
      const handler = vi.fn();
      subscriber.onRoundCrashed(handler);

      const sub = nats.subscriptions[0];
      sub.callback(null, makeMsg({ roundId: 'r1', crashPoint: 2.5, serverSeed: 'seed123' }));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ crashPoint: 2.5, serverSeed: 'seed123' }),
      );
    });
  });

  describe('JSON parse failure', () => {
    it('logs and drops when msg.json() throws', () => {
      const handler = vi.fn();
      subscriber.onRoundNew(handler);

      const sub = nats.subscriptions[0];
      sub.callback(null, { json: () => { throw new Error('invalid JSON'); } });

      expect(handler).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Failed to process NATS message', {
        subject: 'game.test-op.round.new',
        error: 'invalid JSON',
      });
    });
  });

  describe('handler continues after bad message', () => {
    it('processes next valid message after an invalid one', () => {
      const handler = vi.fn();
      subscriber.onRoundNew(handler);

      const sub = nats.subscriptions[0];

      // Invalid message
      sub.callback(null, makeMsg({ roundId: '' }));
      expect(handler).not.toHaveBeenCalled();

      // Valid message
      sub.callback(null, makeMsg({ roundId: 'r1', hashedSeed: 'hash' }));
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('close', () => {
    it('drains all subscriptions', async () => {
      subscriber.onRoundNew(vi.fn());
      subscriber.onTick(vi.fn());
      subscriber.onBetPlaced(vi.fn());

      expect(nats.subscriptions).toHaveLength(3);

      await subscriber.close();

      for (const sub of nats.subscriptions) {
        expect(sub.drain).toHaveBeenCalledOnce();
      }
    });

    it('clears subscription list after close', async () => {
      subscriber.onRoundNew(vi.fn());
      await subscriber.close();

      // Second close should not drain again
      for (const sub of nats.subscriptions) {
        sub.drain.mockClear();
      }
      await subscriber.close();

      for (const sub of nats.subscriptions) {
        expect(sub.drain).not.toHaveBeenCalled();
      }
    });
  });
});
