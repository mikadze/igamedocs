import { describe, it, expect, vi, beforeEach } from 'vitest';
import { connect } from 'nats';
import type { Logger } from '@shared/ports/Logger';
import { createNatsConnection } from '@messaging/infrastructure/nats-connection';

// We test the module by mocking the 'nats' import
vi.mock('nats', () => {
  const mockNc = {
    isClosed: vi.fn(() => false),
    isDraining: vi.fn(() => false),
    status: vi.fn(() => ({
      [Symbol.asyncIterator]: () => ({
        next: () => new Promise(() => {}), // never resolves — hangs forever
      }),
    })),
  };

  return {
    connect: vi.fn(async () => mockNc),
    Events: { Disconnect: 'disconnect', Reconnect: 'reconnect', Error: 'error', LDM: 'ldm' },
    DebugEvents: { Reconnecting: 'reconnecting' },
    __mockNc: mockNc,
  };
});



function createMockLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('createNatsConnection', () => {
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createMockLogger();
  });

  it('calls connect with correct options', async () => {
    await createNatsConnection('nats://localhost:4222', logger);

    expect(connect).toHaveBeenCalledWith({
      servers: 'nats://localhost:4222',
      name: 'realtime-server',
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2_000,
      waitOnFirstConnect: true,
    });
  });

  it('passes token when provided', async () => {
    await createNatsConnection('nats://localhost:4222', logger, 'my-secret-token');

    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'my-secret-token' }),
    );
  });

  it('omits token when not provided', async () => {
    await createNatsConnection('nats://localhost:4222', logger);

    const callArg = vi.mocked(connect).mock.calls[0][0] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty('token');
  });

  it('returns isConnected() = true when connection is open', async () => {
    const { isConnected } = await createNatsConnection('nats://localhost:4222', logger);
    expect(isConnected()).toBe(true);
  });

  it('returns isConnected() = false when connection is closed', async () => {
    const { nc, isConnected } = await createNatsConnection('nats://localhost:4222', logger);

    // Access the mock to change isClosed
    const nats = await import('nats');
    const mockNc = (nats as any).__mockNc;
    mockNc.isClosed.mockReturnValue(true);

    expect(isConnected()).toBe(false);
  });

  it('returns isConnected() = false when connection is draining', async () => {
    await createNatsConnection('nats://localhost:4222', logger);

    const nats = await import('nats');
    const mockNc = (nats as any).__mockNc;
    mockNc.isClosed.mockReturnValue(false);
    mockNc.isDraining.mockReturnValue(true);

    const { isConnected } = await createNatsConnection('nats://localhost:4222', logger);
    // Reset for this test
    mockNc.isDraining.mockReturnValue(true);
    expect(isConnected()).toBe(false);
  });

  it('returns the NatsConnection object', async () => {
    const { nc } = await createNatsConnection('nats://localhost:4222', logger);
    expect(nc).toBeDefined();
    expect(typeof nc.isClosed).toBe('function');
  });
});
