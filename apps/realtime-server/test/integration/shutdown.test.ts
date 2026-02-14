import { describe, it, expect } from 'bun:test';
import {
  createTestServer,
  connectClient,
  createGameEngineSimulator,
  delay,
} from './helpers';

/**
 * RT-5.6 — Graceful Shutdown Integration Test
 *
 * Verifies that on shutdown: all clients receive close frames,
 * NATS is drained, and no messages are lost.
 *
 * Replicates the SIGTERM handler sequence from main.ts
 * without calling process.exit().
 */
describe('RT-5.6: Graceful Shutdown', () => {
  it('all connected clients receive close frame on shutdown', async () => {
    const ctx = await createTestServer();

    const token1 = await ctx.auth.signToken({ playerId: 'shut-p1', operatorId: 'test-op' });
    const token2 = await ctx.auth.signToken({ playerId: 'shut-p2', operatorId: 'test-op' });
    const token3 = await ctx.auth.signToken({ playerId: 'shut-p3', operatorId: 'test-op' });

    const client1 = await connectClient(ctx.url, token1);
    const client2 = await connectClient(ctx.url, token2);
    const client3 = await connectClient(ctx.url, token3);
    await delay(100);

    expect(ctx.connectionStore.count()).toBe(3);

    // Execute shutdown sequence (same as main.ts SIGTERM handler)
    await ctx.subscriber.close();
    await ctx.nc.drain();
    ctx.wsServer.stop();

    // All clients should receive close frames
    const close1 = await client1.waitForClose(3000);
    const close2 = await client2.waitForClose(3000);
    const close3 = await client3.waitForClose(3000);

    expect(close1).toBeDefined();
    expect(close2).toBeDefined();
    expect(close3).toBeDefined();
  });

  it('NATS connection is fully drained after shutdown', async () => {
    const ctx = await createTestServer();

    const token = await ctx.auth.signToken({ playerId: 'drain-p', operatorId: 'test-op' });
    const client = await connectClient(ctx.url, token);
    await delay(50);

    await ctx.subscriber.close();
    await ctx.nc.drain();
    ctx.wsServer.stop();

    expect(ctx.nc.isClosed()).toBe(true);

    await client.waitForClose(3000);
  });

  it('messages published before shutdown are delivered', async () => {
    const ctx = await createTestServer();
    const engine = createGameEngineSimulator(ctx.nc, ctx.topics);

    const token = await ctx.auth.signToken({ playerId: 'drain-msg-p', operatorId: 'test-op' });
    const client = await connectClient(ctx.url, token);
    await delay(50);

    // Publish a message
    engine.publishTick({ roundId: 'drain-round', multiplier: 1.3, elapsedMs: 300 });

    // Small delay to allow NATS delivery
    await delay(100);

    // Then shutdown
    await ctx.subscriber.close();
    await ctx.nc.drain();
    ctx.wsServer.stop();

    await client.waitForClose(3000);

    // The tick should have been delivered before shutdown
    const hasTick = client.messages.some((m) => m.type === 'tick');
    expect(hasTick).toBe(true);
  });
});
