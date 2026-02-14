import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryConnectionStore } from '@connection/infrastructure/InMemoryConnectionStore';
import { Connection } from '@connection/domain/Connection';
import { ConnectionId } from '@connection/domain/ConnectionId';

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

describe('InMemoryConnectionStore', () => {
  let store: InMemoryConnectionStore;

  beforeEach(() => {
    store = new InMemoryConnectionStore();
  });

  it('starts empty with count 0', () => {
    expect(store.count()).toBe(0);
  });

  it('adds a connection and retrieves by id', () => {
    const conn = createJoinedConnection('player-1');
    store.add(conn);

    expect(store.getById(conn.id)).toBe(conn);
    expect(store.count()).toBe(1);
  });

  it('retrieves connection by playerId', () => {
    const conn = createJoinedConnection('player-1');
    store.add(conn);

    expect(store.getByPlayerId('player-1')).toBe(conn);
  });

  it('returns undefined for unknown connection id', () => {
    expect(store.getById(ConnectionId.from('unknown'))).toBeUndefined();
  });

  it('returns undefined for unknown playerId', () => {
    expect(store.getByPlayerId('unknown')).toBeUndefined();
  });

  it('removes a connection by id', () => {
    const conn = createJoinedConnection('player-1');
    store.add(conn);
    store.remove(conn.id);

    expect(store.getById(conn.id)).toBeUndefined();
    expect(store.getByPlayerId('player-1')).toBeUndefined();
    expect(store.count()).toBe(0);
  });

  it('remove is a no-op for unknown id', () => {
    store.remove(ConnectionId.from('unknown'));
    expect(store.count()).toBe(0);
  });

  it('supports multiple connections', () => {
    const conn1 = createJoinedConnection('player-1');
    const conn2 = createJoinedConnection('player-2');
    store.add(conn1);
    store.add(conn2);

    expect(store.count()).toBe(2);
    expect(store.getByPlayerId('player-1')).toBe(conn1);
    expect(store.getByPlayerId('player-2')).toBe(conn2);
  });

  it('replaces player index when same playerId is added with new connection', () => {
    const id1 = ConnectionId.from('conn-1');
    const id2 = ConnectionId.from('conn-2');
    const conn1 = createJoinedConnection('player-1', id1);
    const conn2 = createJoinedConnection('player-1', id2);

    store.add(conn1);
    store.add(conn2);

    expect(store.getByPlayerId('player-1')).toBe(conn2);
    expect(store.count()).toBe(2);
  });

  describe('forEachJoined', () => {
    it('iterates only joined connections', () => {
      const joined1 = createJoinedConnection('player-1');
      const joined2 = createJoinedConnection('player-2');

      const authenticated = Connection.create(
        ConnectionId.generate(),
        'player-3',
        'operator-a',
        Date.now(),
      );

      const disconnected = createJoinedConnection('player-4');
      disconnected.disconnect();

      store.add(joined1);
      store.add(joined2);
      store.add(authenticated);
      store.add(disconnected);

      const visited: string[] = [];
      store.forEachJoined((conn) => visited.push(conn.playerId));

      expect(visited).toHaveLength(2);
      expect(visited).toContain('player-1');
      expect(visited).toContain('player-2');
    });

    it('iterates nothing when store is empty', () => {
      const visited: string[] = [];
      store.forEachJoined((conn) => visited.push(conn.playerId));

      expect(visited).toHaveLength(0);
    });

    it('does not allocate an intermediate array', () => {
      for (let i = 0; i < 100; i++) {
        store.add(createJoinedConnection(`player-${i}`));
      }

      let count = 0;
      store.forEachJoined(() => count++);

      expect(count).toBe(100);
    });
  });
});
