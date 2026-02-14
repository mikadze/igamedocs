import { NatsConnection } from 'nats';
import { FactoryProvider } from '@nestjs/common';
import { natsUrlSchema } from '@messaging/nats-connection.provider';
import { ConsoleLogger } from '@messaging/console-logger.adapter';
import { MessagingModule } from '@messaging/messaging.module';

// ---------------------------------------------------------------------------
// 1. natsUrlSchema
// ---------------------------------------------------------------------------

describe('natsUrlSchema', () => {
  it('accepts nats:// URLs', () => {
    expect(natsUrlSchema.safeParse('nats://localhost:4222').success).toBe(true);
  });

  it('accepts tls:// URLs', () => {
    expect(natsUrlSchema.safeParse('tls://nats.example.com:4222').success).toBe(true);
  });

  it('rejects http:// URLs', () => {
    expect(natsUrlSchema.safeParse('http://localhost:4222').success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(natsUrlSchema.safeParse('').success).toBe(false);
  });

  it('rejects undefined', () => {
    expect(natsUrlSchema.safeParse(undefined).success).toBe(false);
  });

  it('rejects strings with spaces', () => {
    expect(natsUrlSchema.safeParse('nats://local host:4222').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. ConsoleLogger
// ---------------------------------------------------------------------------

describe('ConsoleLogger', () => {
  let logger: ConsoleLogger;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new ConsoleLogger();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('warn delegates to console.warn with prefix', () => {
    logger.warn('test message', { key: 'val' });
    expect(warnSpy).toHaveBeenCalledWith('[WARN] test message', { key: 'val' });
  });

  it('error delegates to console.error with prefix', () => {
    logger.error('test error', { key: 'val' });
    expect(errorSpy).toHaveBeenCalledWith('[ERROR] test error', { key: 'val' });
  });

  it('handles missing context parameter', () => {
    logger.warn('no context');
    expect(warnSpy).toHaveBeenCalledWith('[WARN] no context', '');
  });

  it('handles undefined context for error', () => {
    logger.error('no context');
    expect(errorSpy).toHaveBeenCalledWith('[ERROR] no context', '');
  });
});

// ---------------------------------------------------------------------------
// 3. natsConnectionProvider factory
// ---------------------------------------------------------------------------

describe('natsConnectionProvider', () => {
  const originalEnv = process.env.NATS_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NATS_URL;
    } else {
      process.env.NATS_URL = originalEnv;
    }
  });

  it('throws descriptive error when NATS_URL is missing', async () => {
    delete process.env.NATS_URL;

    // Dynamically import to get a fresh module with the mock
    const { natsConnectionProvider } = await import(
      '@messaging/nats-connection.provider'
    );

    const mockLogger = { warn: jest.fn(), error: jest.fn() };
    const factory = (natsConnectionProvider as FactoryProvider).useFactory as (
      logger: any,
    ) => Promise<any>;

    await expect(factory(mockLogger)).rejects.toThrow('[MessagingModule]');
  });

  it('throws descriptive error when NATS_URL has invalid scheme', async () => {
    process.env.NATS_URL = 'http://localhost:4222';

    const { natsConnectionProvider } = await import(
      '@messaging/nats-connection.provider'
    );

    const mockLogger = { warn: jest.fn(), error: jest.fn() };
    const factory = (natsConnectionProvider as FactoryProvider).useFactory as (
      logger: any,
    ) => Promise<any>;

    await expect(factory(mockLogger)).rejects.toThrow('nats:// or tls://');
  });

  it('calls connect with correct options', async () => {
    process.env.NATS_URL = 'nats://localhost:4222';

    const mockNc = {
      status: jest.fn().mockReturnValue({
        [Symbol.asyncIterator]: () => ({
          next: () => new Promise<{ done: true; value: undefined }>(() => {}),
        }),
      }),
      isClosed: jest.fn().mockReturnValue(false),
      isDraining: jest.fn().mockReturnValue(false),
      drain: jest.fn().mockResolvedValue(undefined),
    };

    jest.resetModules();
    jest.doMock('nats', () => ({
      connect: jest.fn().mockResolvedValue(mockNc),
      Events: {
        Disconnect: 'disconnect',
        Reconnect: 'reconnect',
        Error: 'error',
        LDM: 'ldm',
      },
      DebugEvents: { Reconnecting: 'reconnecting' },
    }));

    const { natsConnectionProvider } = await import(
      '@messaging/nats-connection.provider'
    );
    const { connect } = await import('nats');

    const mockLogger = { warn: jest.fn(), error: jest.fn() };
    const factory = (natsConnectionProvider as FactoryProvider).useFactory as (
      logger: any,
    ) => Promise<any>;

    const nc = await factory(mockLogger);

    expect(connect).toHaveBeenCalledWith({
      servers: 'nats://localhost:4222',
      name: 'crash-game-engine',
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2_000,
      waitOnFirstConnect: true,
    });
    expect(nc).toBe(mockNc);

    jest.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// 4. MessagingModule.onApplicationShutdown
// ---------------------------------------------------------------------------

describe('MessagingModule.onApplicationShutdown', () => {
  it('drains the NATS connection when open', async () => {
    const mockNats = {
      isClosed: jest.fn().mockReturnValue(false),
      isDraining: jest.fn().mockReturnValue(false),
      drain: jest.fn().mockResolvedValue(undefined),
    };

    const mod = new MessagingModule(mockNats as unknown as NatsConnection);
    await mod.onApplicationShutdown();

    expect(mockNats.drain).toHaveBeenCalledTimes(1);
  });

  it('skips drain if already closed', async () => {
    const mockNats = {
      isClosed: jest.fn().mockReturnValue(true),
      isDraining: jest.fn().mockReturnValue(false),
      drain: jest.fn(),
    };

    const mod = new MessagingModule(mockNats as unknown as NatsConnection);
    await mod.onApplicationShutdown();

    expect(mockNats.drain).not.toHaveBeenCalled();
  });

  it('skips drain if already draining', async () => {
    const mockNats = {
      isClosed: jest.fn().mockReturnValue(false),
      isDraining: jest.fn().mockReturnValue(true),
      drain: jest.fn(),
    };

    const mod = new MessagingModule(mockNats as unknown as NatsConnection);
    await mod.onApplicationShutdown();

    expect(mockNats.drain).not.toHaveBeenCalled();
  });
});
