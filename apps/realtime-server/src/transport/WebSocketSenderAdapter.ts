import type { ConnectionId } from '@connection/domain/ConnectionId';
import type { WebSocketSender } from '@connection/application/ports/WebSocketSender';
import type { SocketRegistry } from '@transport/SocketRegistry';
import type { ServerWebSocket, Server } from 'bun';
import type { WsData } from '@transport/wsTypes';

const BROADCAST_TOPIC = 'broadcast';
const MAX_SEND_BUFFER = 65_536; // 64 KB

export class WebSocketSenderAdapter implements WebSocketSender, SocketRegistry {
  private readonly sockets = new Map<string, ServerWebSocket<WsData>>();
  private server: Server<WsData> | null = null;

  setServer(server: Server<WsData>): void {
    this.server = server;
  }

  register(connectionId: ConnectionId, ws: ServerWebSocket<WsData>): void {
    this.sockets.set(connectionId.value, ws);
    ws.subscribe(BROADCAST_TOPIC);
  }

  unregister(connectionId: ConnectionId): void {
    const ws = this.sockets.get(connectionId.value);
    if (ws) {
      ws.unsubscribe(BROADCAST_TOPIC);
    }
    this.sockets.delete(connectionId.value);
  }

  send(connectionId: ConnectionId, data: Uint8Array): void {
    const ws = this.sockets.get(connectionId.value);
    if (!ws) return;
    if ((ws.data.bufferedAmount ?? 0) > MAX_SEND_BUFFER) {
      ws.close(4008, 'Slow consumer');
      this.sockets.delete(connectionId.value);
      return;
    }
    ws.sendBinary(data);
  }

  broadcastToAllJoined(data: Uint8Array): void {
    if (this.server) {
      this.server.publish(BROADCAST_TOPIC, data);
      return;
    }

    // Fallback: iterate sockets if server not yet set
    for (const [key, ws] of this.sockets) {
      if ((ws.data.bufferedAmount ?? 0) > MAX_SEND_BUFFER) {
        ws.close(4008, 'Slow consumer');
        this.sockets.delete(key);
        continue;
      }
      ws.sendBinary(data);
    }
  }

  close(connectionId: ConnectionId, code?: number, reason?: string): void {
    const ws = this.sockets.get(connectionId.value);
    if (ws) {
      ws.close(code, reason);
    }
  }

  getBufferedAmount(connectionId: ConnectionId): number {
    const ws = this.sockets.get(connectionId.value);
    return ws ? ws.data.bufferedAmount ?? 0 : 0;
  }

  get socketCount(): number {
    return this.sockets.size;
  }
}
