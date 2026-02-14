import type { ConnectionId } from '@connection/domain/ConnectionId';

export interface WebSocketSender {
  send(connectionId: ConnectionId, data: Uint8Array): void;
  broadcastToAllJoined(data: Uint8Array): void;
  close(connectionId: ConnectionId, code?: number, reason?: string): void;
  getBufferedAmount(connectionId: ConnectionId): number;
}
