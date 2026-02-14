import { NatsConnection } from 'nats';
import { NatsEventSubscriber } from '@messaging/NatsEventSubscriber';
import { createTopics, GameTopics } from '@messaging/topics';
import { Logger } from '@shared/ports/Logger';

const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('NatsEventSubscriber', () => {
  let subscriber: NatsEventSubscriber;
  let mockNats: { subscribe: jest.Mock };
  let mockLogger: { warn: jest.Mock; error: jest.Mock };
  let topics: GameTopics;
  let capturedCallback: ((err: any, msg: any) => void) | null;

  beforeEach(() => {
    capturedCallback = null;
    mockNats = {
      subscribe: jest.fn((_subject: string, opts: any) => {
        capturedCallback = opts.callback;
        return { unsubscribe: jest.fn(), drain: jest.fn().mockResolvedValue(undefined) };
      }),
    };
    mockLogger = { warn: jest.fn(), error: jest.fn() };
    topics = createTopics('test-op');
    subscriber = new NatsEventSubscriber(
      mockNats as unknown as NatsConnection,
      topics,
      mockLogger as Logger,
    );
  });

  // --- Subscription setup ---

  describe('onPlaceBet', () => {
    it('subscribes to the CMD_PLACE_BET topic', () => {
      subscriber.onPlaceBet(jest.fn());
      expect(mockNats.subscribe).toHaveBeenCalledWith(
        'game.test-op.cmd.place-bet',
        expect.objectContaining({ callback: expect.any(Function) }),
      );
    });

    it('calls handler with validated PlaceBetCommand', () => {
      const handler = jest.fn();
      subscriber.onPlaceBet(handler);

      const cmd = {
        idempotencyKey: VALID_UUID,
        playerId: 'p-1',
        roundId: 'r-1',
        amountCents: 500,
        autoCashout: 2.5,
      };
      capturedCallback!(null, { json: () => cmd });

      expect(handler).toHaveBeenCalledWith(cmd);
    });

    it('calls handler without autoCashout when field is absent', () => {
      const handler = jest.fn();
      subscriber.onPlaceBet(handler);

      const cmd = { idempotencyKey: VALID_UUID, playerId: 'p-1', roundId: 'r-1', amountCents: 500 };
      capturedCallback!(null, { json: () => cmd });

      expect(handler).toHaveBeenCalledWith(cmd);
      expect(handler.mock.calls[0][0].autoCashout).toBeUndefined();
    });
  });

  describe('onCashout', () => {
    it('subscribes to the CMD_CASHOUT topic', () => {
      subscriber.onCashout(jest.fn());
      expect(mockNats.subscribe).toHaveBeenCalledWith(
        'game.test-op.cmd.cashout',
        expect.objectContaining({ callback: expect.any(Function) }),
      );
    });

    it('calls handler with validated CashoutCommand', () => {
      const handler = jest.fn();
      subscriber.onCashout(handler);

      const cmd = { playerId: 'p-1', roundId: 'r-1', betId: 'b-1' };
      capturedCallback!(null, { json: () => cmd });

      expect(handler).toHaveBeenCalledWith(cmd);
    });
  });

  // --- Input validation ---

  describe('input validation', () => {
    it('rejects PlaceBetCommand with negative amountCents', () => {
      const handler = jest.fn();
      subscriber.onPlaceBet(handler);

      capturedCallback!(null, {
        json: () => ({ idempotencyKey: VALID_UUID, playerId: 'p-1', roundId: 'r-1', amountCents: -100 }),
      });

      expect(handler).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid NATS command payload',
        expect.objectContaining({ subject: 'game.test-op.cmd.place-bet' }),
      );
    });

    it('rejects PlaceBetCommand with non-integer amountCents', () => {
      const handler = jest.fn();
      subscriber.onPlaceBet(handler);

      capturedCallback!(null, {
        json: () => ({ idempotencyKey: VALID_UUID, playerId: 'p-1', roundId: 'r-1', amountCents: 10.5 }),
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('rejects PlaceBetCommand with missing playerId', () => {
      const handler = jest.fn();
      subscriber.onPlaceBet(handler);

      capturedCallback!(null, {
        json: () => ({ idempotencyKey: VALID_UUID, roundId: 'r-1', amountCents: 100 }),
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('rejects PlaceBetCommand with non-string playerId', () => {
      const handler = jest.fn();
      subscriber.onPlaceBet(handler);

      capturedCallback!(null, {
        json: () => ({ idempotencyKey: VALID_UUID, playerId: 123, roundId: 'r-1', amountCents: 100 }),
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('rejects CashoutCommand with empty betId', () => {
      const handler = jest.fn();
      subscriber.onCashout(handler);

      capturedCallback!(null, {
        json: () => ({ playerId: 'p-1', roundId: 'r-1', betId: '' }),
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('strips unexpected fields from validated output', () => {
      const handler = jest.fn();
      subscriber.onPlaceBet(handler);

      capturedCallback!(null, {
        json: () => ({
          idempotencyKey: VALID_UUID,
          playerId: 'p-1',
          roundId: 'r-1',
          amountCents: 500,
          __proto__: { admin: true },
          extraField: 'malicious',
        }),
      });

      expect(handler).toHaveBeenCalledTimes(1);
      const parsed = handler.mock.calls[0][0];
      expect(parsed).not.toHaveProperty('extraField');
      expect(parsed).not.toHaveProperty('admin');
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('logs NATS subscription error without throwing', () => {
      subscriber.onPlaceBet(jest.fn());

      const natsError = new Error('connection reset');
      capturedCallback!(natsError, null);

      expect(mockLogger.error).toHaveBeenCalledWith('NATS subscription error', {
        subject: 'game.test-op.cmd.place-bet',
        error: 'connection reset',
      });
    });

    it('does not call handler when NATS error occurs', () => {
      const handler = jest.fn();
      subscriber.onPlaceBet(handler);

      capturedCallback!(new Error('err'), null);

      expect(handler).not.toHaveBeenCalled();
    });

    it('logs parse error on malformed JSON without calling handler', () => {
      const handler = jest.fn();
      subscriber.onPlaceBet(handler);

      capturedCallback!(null, {
        json: () => {
          throw new SyntaxError('Unexpected token');
        },
      });

      expect(handler).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to process NATS message', {
        subject: 'game.test-op.cmd.place-bet',
        error: 'Unexpected token',
      });
    });

    it('handles non-Error thrown values during parse', () => {
      subscriber.onCashout(jest.fn());

      capturedCallback!(null, {
        json: () => {
          throw 'string error';
        },
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to process NATS message', {
        subject: 'game.test-op.cmd.cashout',
        error: 'string error',
      });
    });

    it('continues processing after a bad message', () => {
      const handler = jest.fn();
      subscriber.onPlaceBet(handler);

      // Bad message
      capturedCallback!(null, {
        json: () => {
          throw new Error('bad');
        },
      });

      // Good message
      const cmd = { idempotencyKey: VALID_UUID, playerId: 'p-1', roundId: 'r-1', amountCents: 100 };
      capturedCallback!(null, { json: () => cmd });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(cmd);
    });
  });

  // --- Subscription cleanup ---

  describe('close', () => {
    it('drains all subscriptions', async () => {
      subscriber.onPlaceBet(jest.fn());
      subscriber.onCashout(jest.fn());

      await subscriber.close();

      const subs = mockNats.subscribe.mock.results;
      for (const sub of subs) {
        expect(sub.value.drain).toHaveBeenCalledTimes(1);
      }
    });

    it('clears subscription list after close', async () => {
      subscriber.onPlaceBet(jest.fn());
      await subscriber.close();

      // Second close should be a no-op (no subscriptions to drain)
      await subscriber.close();

      // drain was only called once (from the first close)
      const sub = mockNats.subscribe.mock.results[0];
      expect(sub.value.drain).toHaveBeenCalledTimes(1);
    });
  });
});
