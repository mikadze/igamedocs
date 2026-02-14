import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageDeliveryAdapter } from '@transport/MessageDeliveryAdapter';
import type { WebSocketSender } from '@connection/application/ports/WebSocketSender';
import type { PlayerConnectionLookup } from '@shared/ports/PlayerConnectionLookup';
import type { Logger } from '@shared/ports/Logger';
import { Connection } from '@connection/domain/Connection';
import { ConnectionId } from '@connection/domain/ConnectionId';

function createMockSender(): WebSocketSender {
  return {
    send: vi.fn(),
    broadcastToAllJoined: vi.fn(),
    close: vi.fn(),
    getBufferedAmount: vi.fn(() => 0),
  };
}

function createMockConnectionStore(): PlayerConnectionLookup {
  return {
    getById: vi.fn(),
    getByPlayerId: vi.fn(),
  };
}

function createMockLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createJoinedConnection(playerId: string, id?: ConnectionId): Connection {
  const conn = Connection.create(
    id ?? ConnectionId.generate(),
    playerId,
    'operator-a',
    Date.now(),
  );
  conn.joinRoom();
  return conn;
}

describe('MessageDeliveryAdapter', () => {
  let sender: WebSocketSender;
  let connectionStore: PlayerConnectionLookup;
  let logger: Logger;
  let adapter: MessageDeliveryAdapter;

  beforeEach(() => {
    sender = createMockSender();
    connectionStore = createMockConnectionStore();
    logger = createMockLogger();
    adapter = new MessageDeliveryAdapter(sender, connectionStore, logger);
  });

  describe('sendToPlayer', () => {
    it('sends data to a joined player', () => {
      const connId = ConnectionId.generate();
      const conn = createJoinedConnection('p1', connId);
      vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

      const data = new Uint8Array([1, 2, 3]);
      adapter.sendToPlayer('p1', data);

      expect(sender.send).toHaveBeenCalledWith(connId, data);
    });

    it('warns and drops if player not found', () => {
      vi.mocked(connectionStore.getByPlayerId).mockReturnValue(undefined);

      adapter.sendToPlayer('p1', new Uint8Array([1]));

      expect(sender.send).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Cannot send player-specific message: player not joined',
        { playerId: 'p1' },
      );
    });

    it('warns and drops if player is not joined', () => {
      const conn = Connection.create(
        ConnectionId.generate(),
        'p1',
        'operator-a',
        Date.now(),
      );
      vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

      adapter.sendToPlayer('p1', new Uint8Array([1]));

      expect(sender.send).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('broadcastToAll', () => {
    it('delegates to sender.broadcastToAllJoined', () => {
      const data = new Uint8Array([10, 20, 30]);
      adapter.broadcastToAll(data);

      expect(sender.broadcastToAllJoined).toHaveBeenCalledWith(data);
    });
  });
});
