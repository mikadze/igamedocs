import { describe, it, expect } from 'vitest';
import { Connection } from '@connection/domain/Connection';
import { ConnectionId } from '@connection/domain/ConnectionId';
import { ConnectionState } from '@connection/domain/ConnectionState';
import { InvalidStateTransition } from '@shared/kernel/DomainError';

function createConnection(overrides?: { playerId?: string; operatorId?: string }) {
  return Connection.create(
    ConnectionId.generate(),
    overrides?.playerId ?? 'player-1',
    overrides?.operatorId ?? 'operator-a',
    Date.now(),
  );
}

describe('Connection', () => {
  it('creates in AUTHENTICATED state', () => {
    const conn = createConnection();
    expect(conn.state).toBe(ConnectionState.AUTHENTICATED);
  });

  it('transitions to JOINED via joinRoom()', () => {
    const conn = createConnection();
    conn.joinRoom();
    expect(conn.state).toBe(ConnectionState.JOINED);
  });

  it('isJoined returns true when JOINED', () => {
    const conn = createConnection();
    conn.joinRoom();
    expect(conn.isJoined).toBe(true);
  });

  it('isJoined returns false when AUTHENTICATED', () => {
    const conn = createConnection();
    expect(conn.isJoined).toBe(false);
  });

  it('isJoined returns false when DISCONNECTED', () => {
    const conn = createConnection();
    conn.disconnect();
    expect(conn.isJoined).toBe(false);
  });

  it('transitions to DISCONNECTED via disconnect() from AUTHENTICATED', () => {
    const conn = createConnection();
    conn.disconnect();
    expect(conn.state).toBe(ConnectionState.DISCONNECTED);
  });

  it('transitions to DISCONNECTED via disconnect() from JOINED', () => {
    const conn = createConnection();
    conn.joinRoom();
    conn.disconnect();
    expect(conn.state).toBe(ConnectionState.DISCONNECTED);
  });

  it('throws InvalidStateTransition when joinRoom() called from JOINED', () => {
    const conn = createConnection();
    conn.joinRoom();
    expect(() => conn.joinRoom()).toThrow(InvalidStateTransition);
    expect(() => conn.joinRoom()).toThrow('Cannot join from JOINED');
  });

  it('throws InvalidStateTransition when joinRoom() called from DISCONNECTED', () => {
    const conn = createConnection();
    conn.disconnect();
    expect(() => conn.joinRoom()).toThrow(InvalidStateTransition);
    expect(() => conn.joinRoom()).toThrow('Cannot join from DISCONNECTED');
  });

  it('disconnect is idempotent when already DISCONNECTED', () => {
    const conn = createConnection();
    conn.disconnect();
    conn.disconnect();
    expect(conn.state).toBe(ConnectionState.DISCONNECTED);
  });

  it('preserves id, playerId, operatorId, connectedAt', () => {
    const id = ConnectionId.generate();
    const now = Date.now();
    const conn = Connection.create(id, 'player-42', 'operator-b', now);
    expect(conn.id.equals(id)).toBe(true);
    expect(conn.playerId).toBe('player-42');
    expect(conn.operatorId).toBe('operator-b');
    expect(conn.connectedAt).toBe(now);
  });
});
