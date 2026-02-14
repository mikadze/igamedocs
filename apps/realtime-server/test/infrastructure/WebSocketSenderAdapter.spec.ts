import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocketSenderAdapter } from '@transport/WebSocketSenderAdapter';
import { ConnectionId } from '@connection/domain/ConnectionId';
import type { WsData } from '@transport/wsTypes';

function createMockWs(overrides?: Partial<WsData>) {
  return {
    sendBinary: vi.fn(),
    close: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    data: { bufferedAmount: 0, ...overrides } as Partial<WsData>,
  } as any;
}

function createMockServer() {
  return {
    publish: vi.fn(),
  } as any;
}

describe('WebSocketSenderAdapter', () => {
  let adapter: WebSocketSenderAdapter;

  beforeEach(() => {
    adapter = new WebSocketSenderAdapter();
  });

  it('sends data to a registered connection', () => {
    const id = ConnectionId.from('conn-1');
    const ws = createMockWs();
    adapter.register(id, ws);

    const data = new Uint8Array([1, 2, 3]);
    adapter.send(id, data);

    expect(ws.sendBinary).toHaveBeenCalledWith(data);
  });

  it('no-ops send to unknown connection', () => {
    const id = ConnectionId.from('unknown');
    const data = new Uint8Array([1, 2, 3]);
    expect(() => adapter.send(id, data)).not.toThrow();
  });

  it('closes a registered connection', () => {
    const id = ConnectionId.from('conn-1');
    const ws = createMockWs();
    adapter.register(id, ws);

    adapter.close(id, 4001, 'Replaced');

    expect(ws.close).toHaveBeenCalledWith(4001, 'Replaced');
  });

  it('no-ops close for unknown connection', () => {
    expect(() =>
      adapter.close(ConnectionId.from('unknown'), 1000),
    ).not.toThrow();
  });

  it('stops sending after unregister', () => {
    const id = ConnectionId.from('conn-1');
    const ws = createMockWs();
    adapter.register(id, ws);
    adapter.unregister(id);

    adapter.send(id, new Uint8Array([1]));
    expect(ws.sendBinary).not.toHaveBeenCalled();
  });

  it('reports correct socket count', () => {
    expect(adapter.socketCount).toBe(0);
    adapter.register(ConnectionId.from('c1'), createMockWs());
    expect(adapter.socketCount).toBe(1);
    adapter.register(ConnectionId.from('c2'), createMockWs());
    expect(adapter.socketCount).toBe(2);
    adapter.unregister(ConnectionId.from('c1'));
    expect(adapter.socketCount).toBe(1);
  });

  it('returns 0 buffered amount for unknown connection', () => {
    expect(adapter.getBufferedAmount(ConnectionId.from('unknown'))).toBe(0);
  });

  describe('pub/sub', () => {
    it('subscribes socket to broadcast topic on register', () => {
      const ws = createMockWs();
      adapter.register(ConnectionId.from('c1'), ws);

      expect(ws.subscribe).toHaveBeenCalledWith('broadcast');
    });

    it('unsubscribes socket from broadcast topic on unregister', () => {
      const ws = createMockWs();
      const id = ConnectionId.from('c1');
      adapter.register(id, ws);
      adapter.unregister(id);

      expect(ws.unsubscribe).toHaveBeenCalledWith('broadcast');
    });

    it('uses server.publish for broadcast when server is set', () => {
      const server = createMockServer();
      adapter.setServer(server);

      const data = new Uint8Array([10, 20]);
      adapter.broadcastToAllJoined(data);

      expect(server.publish).toHaveBeenCalledWith('broadcast', data);
    });

    it('falls back to iterating sockets when server is not set', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      adapter.register(ConnectionId.from('c1'), ws1);
      adapter.register(ConnectionId.from('c2'), ws2);

      const data = new Uint8Array([10, 20]);
      adapter.broadcastToAllJoined(data);

      expect(ws1.sendBinary).toHaveBeenCalledWith(data);
      expect(ws2.sendBinary).toHaveBeenCalledWith(data);
    });

    it('does not iterate sockets in fallback after unregister', () => {
      const ws = createMockWs();
      const id = ConnectionId.from('c1');
      adapter.register(id, ws);
      adapter.unregister(id);

      adapter.broadcastToAllJoined(new Uint8Array([1]));
      expect(ws.sendBinary).not.toHaveBeenCalled();
    });
  });

  describe('backpressure', () => {
    it('closes slow consumer on send when buffer exceeds threshold', () => {
      const id = ConnectionId.from('conn-1');
      const ws = createMockWs({ bufferedAmount: 100_000 });
      adapter.register(id, ws);

      adapter.send(id, new Uint8Array([1, 2, 3]));

      expect(ws.close).toHaveBeenCalledWith(4008, 'Slow consumer');
      expect(ws.sendBinary).not.toHaveBeenCalled();
      expect(adapter.socketCount).toBe(0);
    });

    it('sends normally when buffer is within threshold', () => {
      const id = ConnectionId.from('conn-1');
      const ws = createMockWs({ bufferedAmount: 1000 });
      adapter.register(id, ws);

      const data = new Uint8Array([1, 2, 3]);
      adapter.send(id, data);

      expect(ws.sendBinary).toHaveBeenCalledWith(data);
      expect(ws.close).not.toHaveBeenCalled();
    });

    it('closes slow consumers during fallback broadcast', () => {
      const ws1 = createMockWs({ bufferedAmount: 100_000 });
      const ws2 = createMockWs({ bufferedAmount: 0 });
      adapter.register(ConnectionId.from('c1'), ws1);
      adapter.register(ConnectionId.from('c2'), ws2);

      const data = new Uint8Array([10, 20]);
      adapter.broadcastToAllJoined(data);

      expect(ws1.close).toHaveBeenCalledWith(4008, 'Slow consumer');
      expect(ws1.sendBinary).not.toHaveBeenCalled();
      expect(ws2.sendBinary).toHaveBeenCalledWith(data);
      expect(adapter.socketCount).toBe(1);
    });
  });
});
