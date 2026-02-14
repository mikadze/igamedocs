import type { Connection } from '@connection/domain/Connection';
import type { ConnectionId } from '@connection/domain/ConnectionId';
import type { PlayerConnectionLookup } from '@shared/ports/PlayerConnectionLookup';

export interface ConnectionStore extends PlayerConnectionLookup {
  add(connection: Connection): void;
  remove(id: ConnectionId): void;
  count(): number;
}
