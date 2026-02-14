import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HandleConnectionUseCase,
  type ConnectInput,
} from '@connection/application/HandleConnectionUseCase';
import type { ConnectionStore } from '@connection/application/ports/ConnectionStore';
import type { WebSocketSender } from '@connection/application/ports/WebSocketSender';
import { ConnectionId } from '@connection/domain/ConnectionId';
import { Connection } from '@connection/domain/Connection';
import { ConnectionState } from '@connection/domain/ConnectionState';

describe('HandleConnectionUseCase', () => {
  const OPERATOR_ID = 'operator-a';

  let connectionStore: ConnectionStore;
  let webSocketSender: WebSocketSender;
  let useCase: HandleConnectionUseCase;

  beforeEach(() => {
    connectionStore = {
      add: vi.fn(),
      remove: vi.fn(),
      getById: vi.fn(() => undefined),
      getByPlayerId: vi.fn(() => undefined),
      count: vi.fn(() => 0),
    };
    webSocketSender = {
      send: vi.fn(),
      broadcastToAllJoined: vi.fn(),
      close: vi.fn(),
      getBufferedAmount: vi.fn(() => 0),
    };
    useCase = new HandleConnectionUseCase(
      OPERATOR_ID,
      connectionStore,
      webSocketSender,
    );
  });

  const makeInput = (overrides?: Partial<ConnectInput>): ConnectInput => ({
    connectionId: ConnectionId.from('conn-1'),
    playerId: 'player-1',
    operatorId: OPERATOR_ID,
    connectedAt: 1700000000000,
    ...overrides,
  });

  it('creates and stores a connection successfully', () => {
    const result = useCase.execute(makeInput());

    expect(result).toEqual({ success: true });
    expect(connectionStore.add).toHaveBeenCalledTimes(1);
  });

  it('stores the connection in JOINED state', () => {
    useCase.execute(makeInput({ playerId: 'p-42' }));

    const stored = vi.mocked(connectionStore.add).mock.calls[0][0];
    expect(stored.playerId).toBe('p-42');
    expect(stored.operatorId).toBe(OPERATOR_ID);
    expect(stored.state).toBe(ConnectionState.JOINED);
    expect(stored.isJoined).toBe(true);
  });

  it('uses the provided connectionId', () => {
    const id = ConnectionId.from('specific-id');
    useCase.execute(makeInput({ connectionId: id }));

    const stored = vi.mocked(connectionStore.add).mock.calls[0][0];
    expect(stored.id.equals(id)).toBe(true);
  });

  it('uses the provided connectedAt timestamp', () => {
    useCase.execute(makeInput({ connectedAt: 1700000099000 }));

    const stored = vi.mocked(connectionStore.add).mock.calls[0][0];
    expect(stored.connectedAt).toBe(1700000099000);
  });

  it('rejects operator mismatch', () => {
    const result = useCase.execute(makeInput({ operatorId: 'wrong-operator' }));

    expect(result).toEqual({ success: false, error: 'OPERATOR_MISMATCH' });
    expect(connectionStore.add).not.toHaveBeenCalled();
  });

  it('replaces existing connection for same playerId', () => {
    const oldId = ConnectionId.from('old-conn');
    const oldConnection = Connection.create(
      oldId,
      'player-1',
      OPERATOR_ID,
      1699999999000,
    );
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(oldConnection);

    const result = useCase.execute(makeInput({ playerId: 'player-1' }));

    expect(result).toEqual({ success: true });
    expect(webSocketSender.close).toHaveBeenCalledWith(
      oldId,
      4001,
      'Replaced by new connection',
    );
    expect(connectionStore.remove).toHaveBeenCalledWith(oldId);
    expect(connectionStore.add).toHaveBeenCalledTimes(1);
  });

  it('does not close WebSocket when no existing connection', () => {
    useCase.execute(makeInput());

    expect(webSocketSender.close).not.toHaveBeenCalled();
    expect(connectionStore.remove).not.toHaveBeenCalled();
  });
});
