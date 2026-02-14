import { describe, it, expect } from 'vitest';
import { realtimeConfigSchema, loadConfig } from '@config/config.schema';

const TEST_PEM_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z3VS5JJcds3xfn/ygWe
GsXwPKMQKPOEFKEcUBzEbTrS3YHsVhxz0c3GDqsNjlgsIJNaOQH7GKpMfYWJCap
-----END PUBLIC KEY-----`;

describe('realtimeConfigSchema', () => {
  const validEnv = {
    OPERATOR_ID: 'operator-a',
    WS_PORT: '8080',
    NATS_URL: 'nats://localhost:4222',
    JWT_PUBLIC_KEY: TEST_PEM_KEY,
    MAX_CONNECTIONS: '10000',
    LOG_LEVEL: 'info',
  };

  it('accepts valid config', () => {
    const result = realtimeConfigSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.OPERATOR_ID).toBe('operator-a');
      expect(result.data.WS_PORT).toBe(8080);
      expect(result.data.JWT_PUBLIC_KEY).toBe(TEST_PEM_KEY);
    }
  });

  it('applies defaults when optional fields are missing', () => {
    const result = realtimeConfigSchema.safeParse({
      OPERATOR_ID: 'test-op',
      JWT_PUBLIC_KEY: TEST_PEM_KEY,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.WS_PORT).toBe(8080);
      expect(result.data.NATS_URL).toBe('nats://localhost:4222');
      expect(result.data.MAX_CONNECTIONS).toBe(10000);
      expect(result.data.LOG_LEVEL).toBe('info');
      expect(result.data.ALLOWED_ORIGINS).toEqual([]);
    }
  });

  it('parses ALLOWED_ORIGINS as comma-separated list', () => {
    const result = realtimeConfigSchema.safeParse({
      ...validEnv,
      ALLOWED_ORIGINS: 'https://a.com, https://b.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ALLOWED_ORIGINS).toEqual([
        'https://a.com',
        'https://b.com',
      ]);
    }
  });

  it('rejects missing JWT_PUBLIC_KEY with clear error', () => {
    const result = realtimeConfigSchema.safeParse({
      OPERATOR_ID: 'test-op',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const jwtIssue = result.error.issues.find((i) =>
        i.path.includes('JWT_PUBLIC_KEY'),
      );
      expect(jwtIssue).toBeDefined();
    }
  });

  it('rejects JWT_PUBLIC_KEY without PEM header', () => {
    const result = realtimeConfigSchema.safeParse({
      ...validEnv,
      JWT_PUBLIC_KEY: 'a'.repeat(64),
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid OPERATOR_ID format', () => {
    const result = realtimeConfigSchema.safeParse({
      ...validEnv,
      OPERATOR_ID: 'INVALID_ID',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid NATS_URL scheme', () => {
    const result = realtimeConfigSchema.safeParse({
      ...validEnv,
      NATS_URL: 'http://localhost:4222',
    });
    expect(result.success).toBe(false);
  });

  it('coerces string numbers for WS_PORT', () => {
    const result = realtimeConfigSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.WS_PORT).toBe('number');
    }
  });
});

describe('loadConfig', () => {
  it('throws with formatted error when env is invalid', () => {
    const originalEnv = { ...process.env };
    delete process.env.OPERATOR_ID;
    delete process.env.JWT_PUBLIC_KEY;

    try {
      expect(() => loadConfig()).toThrow('[RealtimeConfig]');
    } finally {
      Object.assign(process.env, originalEnv);
    }
  });

  it('returns config and raw when env is valid', () => {
    const originalEnv = { ...process.env };
    process.env.OPERATOR_ID = 'test-op';
    process.env.JWT_PUBLIC_KEY = TEST_PEM_KEY;

    try {
      const { raw, config } = loadConfig();
      expect(raw.OPERATOR_ID).toBe('test-op');
      expect(config.operatorId).toBe('test-op');
      expect(config.wsPort).toBe(8080);
      expect(config.allowedOrigins).toEqual([]);
    } finally {
      Object.assign(process.env, originalEnv);
    }
  });
});
