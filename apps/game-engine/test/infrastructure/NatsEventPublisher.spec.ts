import { NatsConnection } from 'nats';
import { NatsEventPublisher } from '@messaging/NatsEventPublisher';
import { createTopics, GameTopics } from '@messaging/topics';
import { Logger } from '@shared/ports/Logger';
import { BetSnapshot } from '@shared/kernel/BetSnapshot';
import { GameEvent } from '@engine/application/GameEvent';

const encode = (obj: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(obj));

describe('NatsEventPublisher', () => {
  let publisher: NatsEventPublisher;
  let mockNats: { publish: jest.Mock };
  let mockLogger: { warn: jest.Mock; error: jest.Mock };
  let topics: GameTopics;

  beforeEach(() => {
    mockNats = { publish: jest.fn() };
    mockLogger = { warn: jest.fn(), error: jest.fn() };
    topics = createTopics('test-op');
    publisher = new NatsEventPublisher(
      mockNats as unknown as NatsConnection,
      topics,
      mockLogger as Logger,
    );
  });

  const makeBet = (overrides?: Partial<BetSnapshot>): BetSnapshot => ({
    betId: 'bet-1',
    playerId: 'player-1',
    roundId: 'round-1',
    amountCents: 1000,
    status: 'ACTIVE',
    ...overrides,
  });

  // --- Individual method tests ---

  describe('roundNew', () => {
    it('publishes to correct topic with payload', async () => {
      await publisher.roundNew('round-1', 'abc123hash');
      expect(mockNats.publish).toHaveBeenCalledWith(
        'game.test-op.round.new',
        encode({ roundId: 'round-1', hashedSeed: 'abc123hash' }),
      );
    });
  });

  describe('roundBetting', () => {
    it('publishes to correct topic with payload', async () => {
      await publisher.roundBetting('round-1', 1700000000000);
      expect(mockNats.publish).toHaveBeenCalledWith(
        'game.test-op.round.betting',
        encode({ roundId: 'round-1', endsAt: 1700000000000 }),
      );
    });
  });

  describe('roundStarted', () => {
    it('publishes to correct topic with payload', async () => {
      await publisher.roundStarted('round-1');
      expect(mockNats.publish).toHaveBeenCalledWith(
        'game.test-op.round.started',
        encode({ roundId: 'round-1' }),
      );
    });
  });

  describe('roundCrashed', () => {
    it('publishes to correct topic with all fields', async () => {
      await publisher.roundCrashed('round-1', 2.45, 'seed-xyz');
      expect(mockNats.publish).toHaveBeenCalledWith(
        'game.test-op.round.crashed',
        encode({
          roundId: 'round-1',
          crashPoint: 2.45,
          serverSeed: 'seed-xyz',
        }),
      );
    });
  });

  describe('tick', () => {
    it('publishes to correct topic with payload', async () => {
      await publisher.tick('round-1', 1.53, 250);
      expect(mockNats.publish).toHaveBeenCalledWith(
        'game.test-op.tick',
        encode({ roundId: 'round-1', multiplier: 1.53, elapsedMs: 250 }),
      );
    });
  });

  describe('betPlaced', () => {
    it('publishes the BetSnapshot as-is', async () => {
      const bet = makeBet();
      await publisher.betPlaced(bet);
      expect(mockNats.publish).toHaveBeenCalledWith(
        'game.test-op.bet.placed',
        encode(bet),
      );
    });
  });

  describe('betWon', () => {
    it('publishes the BetSnapshot as-is', async () => {
      const bet = makeBet({ status: 'WON', cashoutMultiplier: 2.0, payoutCents: 2000 });
      await publisher.betWon(bet);
      expect(mockNats.publish).toHaveBeenCalledWith(
        'game.test-op.bet.won',
        encode(bet),
      );
    });
  });

  describe('betLost', () => {
    it('publishes BetSnapshot spread with crashPoint', async () => {
      const bet = makeBet({ status: 'LOST' });
      await publisher.betLost(bet, 2.45);
      expect(mockNats.publish).toHaveBeenCalledWith(
        'game.test-op.bet.lost',
        encode({ ...bet, crashPoint: 2.45 }),
      );
    });
  });

  describe('betRejected', () => {
    it('publishes to correct topic with all fields', async () => {
      await publisher.betRejected('player-1', 'round-1', 500, 'BELOW_MIN_BET');
      expect(mockNats.publish).toHaveBeenCalledWith(
        'game.test-op.bet.rejected',
        encode({
          playerId: 'player-1',
          roundId: 'round-1',
          amountCents: 500,
          error: 'BELOW_MIN_BET',
        }),
      );
    });
  });

  describe('creditFailed', () => {
    it('publishes to correct topic with all fields', async () => {
      await publisher.creditFailed('player-1', 'bet-1', 'round-1', 5000, 'TIMEOUT');
      expect(mockNats.publish).toHaveBeenCalledWith(
        'game.test-op.credit.failed',
        encode({
          playerId: 'player-1',
          betId: 'bet-1',
          roundId: 'round-1',
          payoutCents: 5000,
          reason: 'TIMEOUT',
        }),
      );
    });
  });

  // --- Error resilience ---

  describe('error handling', () => {
    it('logs error but does not throw when publish fails', async () => {
      mockNats.publish.mockImplementation(() => {
        throw new Error('connection closed');
      });

      await expect(
        publisher.roundNew('r-1', 'hash'),
      ).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith('NATS publish failed', {
        subject: 'game.test-op.round.new',
        error: 'connection closed',
      });
    });

    it('handles non-Error thrown values', async () => {
      mockNats.publish.mockImplementation(() => {
        throw 'string error';
      });

      await expect(publisher.tick('r-1', 1.0, 0)).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith('NATS publish failed', {
        subject: 'game.test-op.tick',
        error: 'string error',
      });
    });
  });

  // --- publishBatch ---

  describe('publishBatch', () => {
    it('routes each event type to the correct topic', async () => {
      const events: GameEvent[] = [
        { type: 'tick', roundId: 'r-1', multiplier: 1.3, elapsedMs: 50 },
        {
          type: 'bet_won',
          snapshot: makeBet({ status: 'WON', cashoutMultiplier: 1.3, payoutCents: 1300 }),
        },
        {
          type: 'bet_lost',
          snapshot: makeBet({ status: 'LOST' }),
          multiplier: 2.5,
        },
        {
          type: 'round_crashed',
          roundId: 'r-1',
          multiplier: 2.5,
          serverSeed: 'seed-abc',
        },
      ];

      await publisher.publishBatch(events);

      expect(mockNats.publish).toHaveBeenCalledTimes(4);
      const subjects = mockNats.publish.mock.calls.map(
        (c: unknown[]) => c[0],
      );
      expect(subjects).toEqual([
        'game.test-op.tick',
        'game.test-op.bet.won',
        'game.test-op.bet.lost',
        'game.test-op.round.crashed',
      ]);
    });

    it('continues publishing remaining events when one fails', async () => {
      let callCount = 0;
      mockNats.publish.mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('first fails');
      });

      const events: GameEvent[] = [
        { type: 'tick', roundId: 'r-1', multiplier: 1.5, elapsedMs: 100 },
        { type: 'tick', roundId: 'r-1', multiplier: 1.6, elapsedMs: 150 },
      ];

      await publisher.publishBatch(events);

      expect(mockNats.publish).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });

    it('copies events synchronously (double-buffer safety)', async () => {
      const events: GameEvent[] = [
        { type: 'tick', roundId: 'r-1', multiplier: 1.5, elapsedMs: 100 },
      ];

      // Simulate TickEventBuffer clearing the source array after publishBatch
      // captures its reference but before it processes (if it had an await).
      mockNats.publish.mockImplementation(() => {
        events.length = 0;
      });

      await publisher.publishBatch(events);

      expect(mockNats.publish).toHaveBeenCalledTimes(1);
      expect(mockNats.publish).toHaveBeenCalledWith(
        'game.test-op.tick',
        expect.any(Uint8Array),
      );
    });

    it('handles empty batch gracefully', async () => {
      await publisher.publishBatch([]);
      expect(mockNats.publish).not.toHaveBeenCalled();
    });

    it('publishes correct payload for bet_lost (multiplier -> crashPoint)', async () => {
      const bet = makeBet({ status: 'LOST' });
      const events: GameEvent[] = [
        { type: 'bet_lost', snapshot: bet, multiplier: 3.14 },
      ];

      await publisher.publishBatch(events);

      expect(mockNats.publish).toHaveBeenCalledWith(
        'game.test-op.bet.lost',
        encode({ ...bet, crashPoint: 3.14 }),
      );
    });

    it('publishes correct payload for round_crashed', async () => {
      const events: GameEvent[] = [
        {
          type: 'round_crashed',
          roundId: 'r-1',
          multiplier: 2.5,
          serverSeed: 'seed-123',
        },
      ];

      await publisher.publishBatch(events);

      expect(mockNats.publish).toHaveBeenCalledWith(
        'game.test-op.round.crashed',
        encode({
          roundId: 'r-1',
          crashPoint: 2.5,
          serverSeed: 'seed-123',
        }),
      );
    });
  });
});
