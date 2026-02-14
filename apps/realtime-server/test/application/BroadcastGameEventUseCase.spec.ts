import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BroadcastGameEventUseCase } from '@messaging/application/BroadcastGameEventUseCase';
import type { BroadcastInput } from '@messaging/application/BroadcastGameEventUseCase';
import type { PlayerConnectionLookup } from '@shared/ports/PlayerConnectionLookup';
import type { WebSocketSender } from '@connection/application/ports/WebSocketSender';
import type { MessageSerializer } from '@messaging/application/ports/MessageSerializer';
import type { Logger } from '@shared/ports/Logger';
import type { ServerMessage } from '@messaging/domain/ServerMessage';
import { Connection } from '@connection/domain/Connection';
import { ConnectionId } from '@connection/domain/ConnectionId';

function createMockConnectionStore(): PlayerConnectionLookup {
  return {
    getById: vi.fn(),
    getByPlayerId: vi.fn(),
  };
}

function createMockSender(): WebSocketSender {
  return {
    send: vi.fn(),
    broadcastToAllJoined: vi.fn(),
    close: vi.fn(),
    getBufferedAmount: vi.fn(() => 0),
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

function createJoinedConnection(
  playerId: string,
  id?: ConnectionId,
): Connection {
  const conn = Connection.create(
    id ?? ConnectionId.generate(),
    playerId,
    'operator-a',
    Date.now(),
  );
  conn.joinRoom();
  return conn;
}

describe('BroadcastGameEventUseCase', () => {
  let connectionStore: PlayerConnectionLookup;
  let sender: WebSocketSender;
  let serializer: MessageSerializer;
  let logger: Logger;
  let useCase: BroadcastGameEventUseCase;

  beforeEach(() => {
    connectionStore = createMockConnectionStore();
    sender = createMockSender();
    serializer = createMockSerializer();
    logger = createMockLogger();
    useCase = new BroadcastGameEventUseCase(
      connectionStore,
      sender,
      serializer,
      logger,
    );
  });

  describe('broadcast messages (non-player-specific)', () => {
    const tickMessage: ServerMessage = {
      type: 'tick',
      roundId: 'r1',
      multiplier: 1.5,
      elapsedMs: 500,
    };

    it('encodes message once and delegates broadcast to sender', () => {
      useCase.execute({ serverMessage: tickMessage });

      expect(serializer.encodeServerMessage).toHaveBeenCalledOnce();
      expect(serializer.encodeServerMessage).toHaveBeenCalledWith(tickMessage);
      expect(sender.broadcastToAllJoined).toHaveBeenCalledOnce();
      expect(sender.broadcastToAllJoined).toHaveBeenCalledWith(
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

      expect(sender.broadcastToAllJoined).toHaveBeenCalledOnce();
    });
  });

  describe('player-specific messages', () => {
    it('sends bet_rejected only to the target player', () => {
      const connId = ConnectionId.generate();
      const conn = createJoinedConnection('p1', connId);
      vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

      const msg: ServerMessage = {
        type: 'bet_rejected',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 100,
        error: 'ROUND_NOT_BETTING',
      };

      useCase.execute({ serverMessage: msg, targetPlayerId: 'p1' });

      expect(sender.send).toHaveBeenCalledOnce();
      expect(sender.send).toHaveBeenCalledWith(
        connId,
        new Uint8Array([1, 2, 3]),
      );
      expect(sender.broadcastToAllJoined).not.toHaveBeenCalled();
    });

    it('sends credit_failed only to the target player', () => {
      const connId = ConnectionId.generate();
      const conn = createJoinedConnection('p1', connId);
      vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

      const msg: ServerMessage = {
        type: 'credit_failed',
        playerId: 'p1',
        betId: 'b1',
        roundId: 'r1',
        payoutCents: 5000,
        reason: 'TIMEOUT',
      };

      useCase.execute({ serverMessage: msg, targetPlayerId: 'p1' });

      expect(sender.send).toHaveBeenCalledOnce();
      expect(sender.broadcastToAllJoined).not.toHaveBeenCalled();
    });

    it('warns and drops if target player is not found', () => {
      vi.mocked(connectionStore.getByPlayerId).mockReturnValue(undefined);

      const msg: ServerMessage = {
        type: 'bet_rejected',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 100,
        error: 'ERR',
      };

      useCase.execute({ serverMessage: msg, targetPlayerId: 'p1' });

      expect(sender.send).not.toHaveBeenCalled();
      expect(sender.broadcastToAllJoined).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Cannot send player-specific message: player not joined',
        { playerId: 'p1' },
      );
    });

    it('warns and drops if target player is not JOINED', () => {
      const conn = Connection.create(
        ConnectionId.generate(),
        'p1',
        'operator-a',
        Date.now(),
      );
      vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

      const msg: ServerMessage = {
        type: 'bet_rejected',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 100,
        error: 'ERR',
      };

      useCase.execute({ serverMessage: msg, targetPlayerId: 'p1' });

      expect(sender.send).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
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

      expect(sender.broadcastToAllJoined).toHaveBeenCalledWith(encodedData);
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

      expect(sender.broadcastToAllJoined).toHaveBeenCalledOnce();
      expect(sender.send).not.toHaveBeenCalled();
    });
  });
});
