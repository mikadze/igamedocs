import { ProvablyFair } from '@rng/domain/ProvablyFair';

describe('ProvablyFair', () => {
  const HOUSE_EDGE = 4;

  describe('generateServerSeed', () => {
    it('returns a 64-character hex string', () => {
      const seed = ProvablyFair.generateServerSeed();
      expect(seed).toMatch(/^[0-9a-f]{64}$/);
    });

    it('generates unique seeds', () => {
      const a = ProvablyFair.generateServerSeed();
      const b = ProvablyFair.generateServerSeed();
      expect(a).not.toBe(b);
    });
  });

  describe('hashServerSeed', () => {
    it('is deterministic', () => {
      const seed = 'a'.repeat(64);
      const hash1 = ProvablyFair.hashServerSeed(seed);
      const hash2 = ProvablyFair.hashServerSeed(seed);
      expect(hash1).toBe(hash2);
    });

    it('returns a 64-character hex string (SHA-256)', () => {
      const hash = ProvablyFair.hashServerSeed('a'.repeat(64));
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('calculateCrashPoint', () => {
    const serverSeed = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const clientSeed = 'test-client-seed';

    it('is deterministic with same inputs', () => {
      const a = ProvablyFair.calculateCrashPoint(serverSeed, clientSeed, 0, HOUSE_EDGE);
      const b = ProvablyFair.calculateCrashPoint(serverSeed, clientSeed, 0, HOUSE_EDGE);
      expect(a.value).toBe(b.value);
    });

    it('always returns >= 1.00', () => {
      for (let nonce = 0; nonce < 100; nonce++) {
        const cp = ProvablyFair.calculateCrashPoint(serverSeed, clientSeed, nonce, HOUSE_EDGE);
        expect(cp.value).toBeGreaterThanOrEqual(1.0);
      }
    });

    it('produces different results for different nonces', () => {
      const results = new Set<number>();
      for (let nonce = 0; nonce < 50; nonce++) {
        const cp = ProvablyFair.calculateCrashPoint(serverSeed, clientSeed, nonce, HOUSE_EDGE);
        results.add(cp.value);
      }
      expect(results.size).toBeGreaterThan(1);
    });

    it('~4% instant crashes over large sample', () => {
      const seed = ProvablyFair.generateServerSeed();
      let instantCrashes = 0;
      const samples = 10000;
      for (let i = 0; i < samples; i++) {
        const cp = ProvablyFair.calculateCrashPoint(seed, 'sample-client', i, HOUSE_EDGE);
        if (cp.value === 1.0) instantCrashes++;
      }
      const rate = instantCrashes / samples;
      // Allow ±1.5% tolerance (expected ~4%)
      expect(rate).toBeGreaterThan(0.025);
      expect(rate).toBeLessThan(0.055);
    });
  });

  describe('verify', () => {
    const serverSeed = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const clientSeed = 'test-client-seed';
    const nonce = 0;

    it('returns true for a correctly calculated crash point', () => {
      const cp = ProvablyFair.calculateCrashPoint(serverSeed, clientSeed, nonce, HOUSE_EDGE);
      expect(ProvablyFair.verify(serverSeed, clientSeed, nonce, cp.value, HOUSE_EDGE)).toBe(true);
    });

    it('returns false for an incorrect crash point', () => {
      expect(ProvablyFair.verify(serverSeed, clientSeed, nonce, 999.99, HOUSE_EDGE)).toBe(false);
    });
  });
});
