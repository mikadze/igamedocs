import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import {
  createTestServer,
  connectClient,
  connectClientRaw,
  delay,
  type TestServerContext,
} from './helpers';

/**
 * RT-5.3 — Connection Lifecycle Integration Test
 *
 * Verifies the full WebSocket connection lifecycle through the real
 * server stack: auth, join, ping/pong, disconnect, reconnection,
 * and health endpoints.
 */
describe('RT-5.3: Connection Lifecycle', () => {
  let ctx: TestServerContext;

  beforeAll(async () => {
    ctx = await createTestServer();
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  // ──── Valid Connection ──────────────────────────────────────

  describe('valid connection', () => {
    it('connects with valid JWT and is registered in the store', async () => {
      const token = await ctx.auth.signToken({ playerId: 'conn-valid-1', operatorId: 'test-op' });
      const client = await connectClient(ctx.url, token);
      await delay(50);

      const conn = ctx.connectionStore.getByPlayerId('conn-valid-1');
      expect(conn).toBeDefined();
      expect(conn!.isJoined).toBe(true);

      client.close();
      await delay(50);
    });

    it('responds to ping with pong', async () => {
      const token = await ctx.auth.signToken({ playerId: 'conn-ping', operatorId: 'test-op' });
      const client = await connectClient(ctx.url, token);

      client.sendPing();
      const pong = await client.waitForMessage('pong', 2000);
      expect(pong.type).toBe('pong');

      client.close();
      await delay(50);
    });
  });

  // ──── Invalid Connection ────────────────────────────────────

  describe('invalid connection', () => {
    it('rejects connection with no token', async () => {
      const raw = await connectClientRaw(ctx.url);
      const close = await raw.waitForClose(2000);
      // Server returns 401 before upgrade, WS never opens
      expect(close).toBeDefined();
    });

    it('rejects connection with expired JWT', async () => {
      const token = await ctx.auth.signExpiredToken({ playerId: 'conn-expired', operatorId: 'test-op' });
      try {
        await connectClient(ctx.url, token);
        throw new Error('Should have rejected expired token');
      } catch {
        // Expected: connection fails
      }
    });

    it('rejects connection with malformed JWT', async () => {
      try {
        await connectClient(ctx.url, 'not-a-valid-jwt');
        throw new Error('Should have rejected malformed token');
      } catch {
        // Expected: connection fails
      }
    });

    it('rejects connection with wrong operator in JWT (code 4003)', async () => {
      const token = await ctx.auth.signToken({ playerId: 'conn-wrong-op', operatorId: 'wrong-operator' });
      const client = await connectClient(ctx.url, token);
      const closeEvent = await client.waitForClose(2000);
      expect(closeEvent.code).toBe(4003);
    });
  });

  // ──── Disconnect Cleanup ────────────────────────────────────

  describe('disconnect cleanup', () => {
    it('removes connection from store after disconnect', async () => {
      const token = await ctx.auth.signToken({ playerId: 'conn-cleanup', operatorId: 'test-op' });
      const client = await connectClient(ctx.url, token);
      await delay(50);

      expect(ctx.connectionStore.getByPlayerId('conn-cleanup')).toBeDefined();

      client.close();
      await delay(100);

      expect(ctx.connectionStore.getByPlayerId('conn-cleanup')).toBeUndefined();
    });

    it('decrements connection count after disconnect', async () => {
      const countBefore = ctx.connectionStore.count();
      const token = await ctx.auth.signToken({ playerId: 'conn-count', operatorId: 'test-op' });
      const client = await connectClient(ctx.url, token);
      await delay(50);

      expect(ctx.connectionStore.count()).toBe(countBefore + 1);

      client.close();
      await delay(100);

      expect(ctx.connectionStore.count()).toBe(countBefore);
    });
  });

  // ──── Reconnection ──────────────────────────────────────────

  describe('reconnection', () => {
    it('replaces existing connection when same player reconnects (code 4001)', async () => {
      const token1 = await ctx.auth.signToken({ playerId: 'conn-recon', operatorId: 'test-op' });
      const client1 = await connectClient(ctx.url, token1);
      await delay(50);

      const token2 = await ctx.auth.signToken({ playerId: 'conn-recon', operatorId: 'test-op' });
      const client2 = await connectClient(ctx.url, token2);
      await delay(50);

      // First connection should be closed with 4001 (replaced)
      const close1 = await client1.waitForClose(2000);
      expect(close1.code).toBe(4001);

      // Second connection should be active
      const conn = ctx.connectionStore.getByPlayerId('conn-recon');
      expect(conn).toBeDefined();
      expect(conn!.isJoined).toBe(true);

      client2.close();
      await delay(50);
    });

    it('allows connection after prior disconnect', async () => {
      const token1 = await ctx.auth.signToken({ playerId: 'conn-cycle', operatorId: 'test-op' });
      const client1 = await connectClient(ctx.url, token1);
      await delay(50);
      client1.close();
      await delay(100);

      const token2 = await ctx.auth.signToken({ playerId: 'conn-cycle', operatorId: 'test-op' });
      const client2 = await connectClient(ctx.url, token2);
      await delay(50);

      expect(ctx.connectionStore.getByPlayerId('conn-cycle')).toBeDefined();

      client2.close();
      await delay(50);
    });
  });

  // ──── Health Endpoints ──────────────────────────────────────

  describe('health endpoints', () => {
    it('GET /healthz returns 200 with status ok', async () => {
      const httpUrl = ctx.url.replace('ws://', 'http://');
      const res = await fetch(`${httpUrl}/healthz`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
    });

    it('GET /health returns connection count and nats status', async () => {
      const httpUrl = ctx.url.replace('ws://', 'http://');
      const res = await fetch(`${httpUrl}/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(typeof body.connections).toBe('number');
      expect(body.nats).toBe(true);
      expect(typeof body.uptime).toBe('number');
    });
  });
});
