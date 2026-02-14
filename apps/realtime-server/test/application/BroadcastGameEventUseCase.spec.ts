import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BroadcastGameEventUseCase } from '@messaging/application/BroadcastGameEventUseCase';
import type { MessageDelivery } from '@messaging/application/ports/MessageDelivery';
import type { MessageSerializer } from '@messaging/application/ports/MessageSerializer';
import type { Logger } from '@shared/ports/Logger';
import type { ServerMessage } from '@messaging/domain/ServerMessage';

function createMockDelivery(): MessageDelivery {
  return {
    sendToPlayer: vi.fn(),
    broadcastToAll: vi.fn(),
  };
}

function createMockSerializer(): MessageSerializer {
  return {
    encodeServerMessage: vi.fn(() => new Uint8Array([1, 2, 3])),
    decodeClientMessage: vi.fn(),
  };
}

function createMockLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('BroadcastGameEventUseCase', () => {
  let delivery: MessageDelivery;
  let serializer: MessageSerializer;
  let logger: Logger;
  let useCase: BroadcastGameEventUseCase;

  beforeEach(() => {
    delivery = createMockDelivery();
    serializer = createMockSerializer();
    logger = createMockLogger();
    useCase = new BroadcastGameEventUseCase(delivery, serializer, logger);
  });

  describe('broadcast messages (non-player-specific)', () => {
    const tickMessage: ServerMessage = {
      type: 'tick',
      roundId: 'r1',
      multiplier: 1.5,
      elapsedMs: 500,
    };

    it('encodes message once and delegates broadcast to delivery', () => {
      useCase.execute({ serverMessage: tickMessage });

      expect(serializer.encodeServerMessage).toHaveBeenCalledOnce();
      expect(serializer.encodeServerMessage).toHaveBeenCalledWith(tickMessage);
      expect(delivery.broadcastToAll).toHaveBeenCalledOnce();
      expect(delivery.broadcastToAll).toHaveBeenCalledWith(
        new Uint8Array([1, 2, 3]),
      );
    });

    it.each([
      {
        type: 'round_new' as const,
        msg: { type: 'round_new' as const, roundId: 'r1', hashedSeed: 'h' },
      },
      {
        type: 'round_started' as const,
        msg: { type: 'round_started' as const, roundId: 'r1' },
      },
      {
        type: 'bet_placed' as const,
        msg: {
          type: 'bet_placed' as const,
          betId: 'b1',
          playerId: 'p1',
          roundId: 'r1',
          amountCents: 100,
        },
      },
      {
        type: 'bet_won' as const,
        msg: {
          type: 'bet_won' as const,
          betId: 'b1',
          playerId: 'p1',
          roundId: 'r1',
          amountCents: 100,
          cashoutMultiplier: 2.0,
          payoutCents: 200,
        },
      },
      {
        type: 'bet_lost' as const,
        msg: {
          type: 'bet_lost' as const,
          betId: 'b1',
          playerId: 'p1',
          roundId: 'r1',
          amountCents: 100,
          crashPoint: 1.5,
        },
      },
    ])('broadcasts $type to all joined', ({ msg }) => {
      useCase.execute({ serverMessage: msg });

      expect(delivery.broadcastToAll).toHaveBeenCalledOnce();
    });
  });

  describe('player-specific messages', () => {
    it('sends bet_rejected only to the target player', () => {
      const msg: ServerMessage = {
        type: 'bet_rejected',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 100,
        error: 'ROUND_NOT_BETTING',
      };

      useCase.execute({ serverMessage: msg, targetPlayerId: 'p1' });

      expect(delivery.sendToPlayer).toHaveBeenCalledOnce();
      expect(delivery.sendToPlayer).toHaveBeenCalledWith(
        'p1',
        new Uint8Array([1, 2, 3]),
      );
      expect(delivery.broadcastToAll).not.toHaveBeenCalled();
    });

    it('sends credit_failed only to the target player', () => {
      const msg: ServerMessage = {
        type: 'credit_failed',
        playerId: 'p1',
        betId: 'b1',
        roundId: 'r1',
        payoutCents: 5000,
        reason: 'TIMEOUT',
      };

      useCase.execute({ serverMessage: msg, targetPlayerId: 'p1' });

      expect(delivery.sendToPlayer).toHaveBeenCalledOnce();
      expect(delivery.broadcastToAll).not.toHaveBeenCalled();
    });
  });

  describe('serialization', () => {
    it('calls encodeServerMessage exactly once per execute', () => {
      const msg: ServerMessage = {
        type: 'tick',
        roundId: 'r1',
        multiplier: 1.5,
        elapsedMs: 500,
      };
      useCase.execute({ serverMessage: msg });

      expect(serializer.encodeServerMessage).toHaveBeenCalledOnce();
    });

    it('uses the same Uint8Array for broadcast', () => {
      const encodedData = new Uint8Array([10, 20, 30]);
      vi.mocked(serializer.encodeServerMessage).mockReturnValue(encodedData);

      const msg: ServerMessage = { type: 'round_started', roundId: 'r1' };
      useCase.execute({ serverMessage: msg });

      expect(delivery.broadcastToAll).toHaveBeenCalledWith(encodedData);
    });
  });

  describe('edge cases', () => {
    it('broadcasts when targetPlayerId is set but type is not player-specific', () => {
      const msg: ServerMessage = {
        type: 'bet_placed',
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 100,
      };

      useCase.execute({ serverMessage: msg, targetPlayerId: 'p1' });

      expect(delivery.broadcastToAll).toHaveBeenCalledOnce();
      expect(delivery.sendToPlayer).not.toHaveBeenCalled();
    });
  });
});
