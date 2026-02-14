import { describe, it, expect, vi } from 'vitest';
import { extractToken, handleUpgrade } from '@transport/upgradeHandler';
import type { UpgradeHandlerDeps } from '@transport/upgradeHandler';

describe('extractToken', () => {
  it('extracts token from query string', () => {
    const req = new Request('http://localhost:8080/ws?token=jwt-123');
    expect(extractToken(req)).toBe('jwt-123');
  });

  it('extracts token from Authorization Bearer header', () => {
    const req = new Request('http://localhost:8080/ws', {
      headers: { Authorization: 'Bearer jwt-456' },
    });
    expect(extractToken(req)).toBe('jwt-456');
  });

  it('prefers query string over header', () => {
    const req = new Request('http://localhost:8080/ws?token=from-query', {
      headers: { Authorization: 'Bearer from-header' },
    });
    expect(extractToken(req)).toBe('from-query');
  });

  it('returns null when no token provided', () => {
    const req = new Request('http://localhost:8080/ws');
    expect(extractToken(req)).toBeNull();
  });

  it('returns null for non-Bearer auth header', () => {
    const req = new Request('http://localhost:8080/ws', {
      headers: { Authorization: 'Basic abc123' },
    });
    expect(extractToken(req)).toBeNull();
  });
});

describe('handleUpgrade', () => {
  function createDeps(overrides?: Partial<UpgradeHandlerDeps>): UpgradeHandlerDeps {
    return {
      authGateway: {
        verify: vi.fn().mockResolvedValue({ playerId: 'p1', operatorId: 'op1' }),
      },
      connectionStore: { count: vi.fn(() => 0), add: vi.fn(), remove: vi.fn(), getById: vi.fn(), getByPlayerId: vi.fn() } as any,
      maxConnections: 100,
      allowedOrigins: [],
      ...overrides,
    };
  }

  function createServer() {
    return { upgrade: vi.fn(() => true) };
  }

  describe('origin validation', () => {
    it('rejects requests with wrong origin when allowedOrigins is set', async () => {
      const deps = createDeps({ allowedOrigins: ['https://app.example.com'] });
      const req = new Request('http://localhost:8080/ws?token=jwt', {
        headers: { Origin: 'https://evil.com' },
      });

      const result = await handleUpgrade(req, createServer(), deps);

      expect(result).toBeInstanceOf(Response);
      expect(result!.status).toBe(403);
    });

    it('rejects requests with no origin when allowedOrigins is set', async () => {
      const deps = createDeps({ allowedOrigins: ['https://app.example.com'] });
      const req = new Request('http://localhost:8080/ws?token=jwt');

      const result = await handleUpgrade(req, createServer(), deps);

      expect(result).toBeInstanceOf(Response);
      expect(result!.status).toBe(403);
    });

    it('allows requests with matching origin', async () => {
      const deps = createDeps({ allowedOrigins: ['https://app.example.com'] });
      const server = createServer();
      const req = new Request('http://localhost:8080/ws?token=jwt', {
        headers: { Origin: 'https://app.example.com' },
      });

      const result = await handleUpgrade(req, server, deps);

      expect(result).toBeUndefined();
      expect(server.upgrade).toHaveBeenCalled();
    });

    it('skips origin check when allowedOrigins is empty', async () => {
      const deps = createDeps({ allowedOrigins: [] });
      const server = createServer();
      const req = new Request('http://localhost:8080/ws?token=jwt');

      const result = await handleUpgrade(req, server, deps);

      expect(result).toBeUndefined();
      expect(server.upgrade).toHaveBeenCalled();
    });
  });

  describe('connection limits', () => {
    it('returns 503 when max connections reached', async () => {
      const deps = createDeps({
        connectionStore: { count: vi.fn(() => 100) } as any,
        maxConnections: 100,
      });
      const req = new Request('http://localhost:8080/ws?token=jwt');

      const result = await handleUpgrade(req, createServer(), deps);

      expect(result!.status).toBe(503);
    });
  });

  describe('authentication', () => {
    it('returns 401 when no token provided', async () => {
      const deps = createDeps();
      const req = new Request('http://localhost:8080/ws');

      const result = await handleUpgrade(req, createServer(), deps);

      expect(result!.status).toBe(401);
    });

    it('returns 401 when token verification fails', async () => {
      const deps = createDeps({
        authGateway: { verify: vi.fn().mockResolvedValue(null) },
      });
      const req = new Request('http://localhost:8080/ws?token=bad');

      const result = await handleUpgrade(req, createServer(), deps);

      expect(result!.status).toBe(401);
    });
  });

  describe('upgrade', () => {
    it('generates ConnectionId at upgrade time', async () => {
      const deps = createDeps();
      const server = createServer();
      const req = new Request('http://localhost:8080/ws?token=jwt');

      await handleUpgrade(req, server, deps);

      expect(server.upgrade).toHaveBeenCalledWith(
        req,
        expect.objectContaining({
          data: expect.objectContaining({
            connectionId: expect.objectContaining({ value: expect.any(String) }),
            playerId: 'p1',
            operatorId: 'op1',
          }),
        }),
      );
    });

    it('returns 400 when upgrade fails', async () => {
      const deps = createDeps();
      const server = { upgrade: vi.fn(() => false) };
      const req = new Request('http://localhost:8080/ws?token=jwt');

      const result = await handleUpgrade(req, server, deps);

      expect(result!.status).toBe(400);
    });
  });
});
