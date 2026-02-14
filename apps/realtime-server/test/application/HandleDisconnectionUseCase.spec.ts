import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HandleDisconnectionUseCase } from '@connection/application/HandleDisconnectionUseCase';
import type { ConnectionStore } from '@connection/application/ports/ConnectionStore';
import { ConnectionId } from '@connection/domain/ConnectionId';
import { Connection } from '@connection/domain/Connection';
import { ConnectionState } from '@connection/domain/ConnectionState';

describe('HandleDisconnectionUseCase', () => {
  let connectionStore: ConnectionStore;
  let useCase: HandleDisconnectionUseCase;

  beforeEach(() => {
    connectionStore = {
      add: vi.fn(),
      remove: vi.fn(),
      getById: vi.fn(() => undefined),
      getByPlayerId: vi.fn(() => undefined),
      count: vi.fn(() => 0),
    };
    useCase = new HandleDisconnectionUseCase(connectionStore);
  });

  it('disconnects and removes an existing JOINED connection', () => {
    const id = ConnectionId.from('conn-1');
    const connection = Connection.create(id, 'player-1', 'operator-a', Date.now());
    connection.joinRoom();
    vi.mocked(connectionStore.getById).mockReturnValue(connection);

    useCase.execute({ connectionId: id });

    expect(connection.state).toBe(ConnectionState.DISCONNECTED);
    expect(connectionStore.remove).toHaveBeenCalledWith(id);
  });

  it('disconnects an AUTHENTICATED connection (not yet joined)', () => {
    const id = ConnectionId.from('conn-2');
    const connection = Connection.create(id, 'player-2', 'operator-a', Date.now());
    vi.mocked(connectionStore.getById).mockReturnValue(connection);

    useCase.execute({ connectionId: id });

    expect(connection.state).toBe(ConnectionState.DISCONNECTED);
    expect(connectionStore.remove).toHaveBeenCalledWith(id);
  });

  it('is no-op when connection not found', () => {
    const id = ConnectionId.from('unknown');

    useCase.execute({ connectionId: id });

    expect(connectionStore.remove).not.toHaveBeenCalled();
  });

  it('handles already-disconnected connection gracefully', () => {
    const id = ConnectionId.from('conn-3');
    const connection = Connection.create(id, 'player-3', 'operator-a', Date.now());
    connection.disconnect();
    vi.mocked(connectionStore.getById).mockReturnValue(connection);

    useCase.execute({ connectionId: id });

    expect(connection.state).toBe(ConnectionState.DISCONNECTED);
    expect(connectionStore.remove).toHaveBeenCalledWith(id);
  });
});
