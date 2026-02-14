import type { Connection } from '@connection/domain/Connection';
import type { ConnectionId } from '@connection/domain/ConnectionId';

export interface PlayerConnectionLookup {
  getById(id: ConnectionId): Connection | undefined;
  getByPlayerId(playerId: string): Connection | undefined;
}
