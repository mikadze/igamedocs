import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import {
  createTestServer,
  connectClient,
  createGameEngineSimulator,
  delay,
  type TestServerContext,
  type TestWsClient,
  type GameEngineSimulator,
} from './helpers';

/**
 * RT-5.5 — Load Test: Concurrent Connections
 *
 * Verifies the server handles 1000 concurrent WebSocket connections
 * with tick broadcast latency < 20ms, no connection drops, and
 * stable memory usage.
 */
describe('RT-5.5: Load Test', () => {
  let ctx: TestServerContext;
  let engine: GameEngineSimulator;
  const clients: TestWsClient[] = [];

  const TOTAL_CONNECTIONS = 1000;
  const BATCH_SIZE = 100;

  beforeAll(async () => {
    ctx = await createTestServer({ operatorId: 'load-op' });
    engine = createGameEngineSimulator(ctx.nc, ctx.topics);

    // Connect clients in batches to avoid overwhelming the server
    for (let batch = 0; batch < TOTAL_CONNECTIONS / BATCH_SIZE; batch++) {
      const tokens = await Promise.all(
        Array.from({ length: BATCH_SIZE }, (_, i) => {
          const idx = batch * BATCH_SIZE + i;
          return ctx.auth.signToken({ playerId: `lp-${idx}`, operatorId: 'load-op' });
        }),
      );

      const batchClients = await Promise.all(
        tokens.map((token) => connectClient(ctx.url, token)),
      );
      clients.push(...batchClients);
    }

    // Allow all connections to settle
    await delay(500);
  }, 120_000);

  afterAll(async () => {
    for (const c of clients) c.close();
    await delay(500);
    await ctx.teardown();
  }, 30_000);

  it('maintains 1000 concurrent connections', () => {
    expect(clients.length).toBe(TOTAL_CONNECTIONS);
    expect(ctx.connectionStore.count()).toBe(TOTAL_CONNECTIONS);
  });

  it(
    'broadcasts tick to all clients within 20ms of NATS publish',
    async () => {
      const publishTime = performance.now();
      engine.publishTick({ roundId: 'load-round', multiplier: 1.5, elapsedMs: 100 });

      // Sample 50 random clients for latency measurement
      const SAMPLE_SIZE = 50;
      const sampleIndices = Array.from({ length: SAMPLE_SIZE }, () =>
        Math.floor(Math.random() * clients.length),
      );

      const receivePromises = sampleIndices.map((idx) =>
        clients[idx].waitForMessage('tick', 5000).then(() => performance.now()),
      );

      const receiveTimes = await Promise.all(receivePromises);

      for (const receiveTime of receiveTimes) {
        const latency = receiveTime - publishTime;
        expect(latency).toBeLessThan(20);
      }
    },
    30_000,
  );

  it('has no dropped connections after load', () => {
    let closedCount = 0;
    for (const client of clients) {
      if (client.ws.readyState === WebSocket.CLOSED) {
        closedCount++;
      }
    }
    expect(closedCount).toBe(0);
  });

  it(
    'memory remains stable under burst',
    async () => {
      // Force GC if available to get clean baseline
      if (typeof Bun.gc === 'function') Bun.gc(true);
      await delay(200);

      const before = process.memoryUsage().heapUsed;

      // Publish 100 ticks (each broadcasts to 1000 clients)
      for (let i = 0; i < 100; i++) {
        engine.publishTick({ roundId: 'mem-round', multiplier: 1.0 + i * 0.01, elapsedMs: i * 10 });
      }

      // Wait for delivery
      await delay(2000);

      if (typeof Bun.gc === 'function') Bun.gc(true);
      await delay(200);

      const after = process.memoryUsage().heapUsed;
      const growthMB = (after - before) / (1024 * 1024);

      // Memory growth should be < 50MB for 100 ticks x 1000 clients
      expect(growthMB).toBeLessThan(50);
    },
    30_000,
  );
});
