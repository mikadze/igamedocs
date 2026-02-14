import type { Connection } from '@connection/domain/Connection';
import type { ConnectionId } from '@connection/domain/ConnectionId';
import type { ConnectionStore } from '@connection/application/ports/ConnectionStore';

export class InMemoryConnectionStore implements ConnectionStore {
  private readonly connections = new Map<string, Connection>();
  private readonly playerIndex = new Map<string, ConnectionId>();

  add(connection: Connection): void {
    this.connections.set(connection.id.value, connection);
    this.playerIndex.set(connection.playerId, connection.id);
  }

  remove(id: ConnectionId): void {
    const connection = this.connections.get(id.value);
    if (connection) {
      this.playerIndex.delete(connection.playerId);
      this.connections.delete(id.value);
    }
  }

  getById(id: ConnectionId): Connection | undefined {
    return this.connections.get(id.value);
  }

  getByPlayerId(playerId: string): Connection | undefined {
    const id = this.playerIndex.get(playerId);
    if (!id) return undefined;
    return this.connections.get(id.value);
  }

  count(): number {
    return this.connections.size;
  }

  forEachJoined(callback: (connection: Connection) => void): void {
    for (const connection of this.connections.values()) {
      if (connection.isJoined) {
        callback(connection);
      }
    }
  }
}
