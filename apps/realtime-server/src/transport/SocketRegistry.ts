import type { ConnectionId } from '@connection/domain/ConnectionId';
import type { ServerWebSocket } from 'bun';
import type { WsData } from '@transport/wsTypes';

export interface SocketRegistry {
  register(connectionId: ConnectionId, ws: ServerWebSocket<WsData>): void;
  unregister(connectionId: ConnectionId): void;
}
