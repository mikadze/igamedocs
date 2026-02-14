import { RotatingSeedChainProvider } from '@rng/infrastructure/RotatingSeedChainProvider';
import { SeedChain } from '@rng/domain/SeedChain';
import { Logger } from '@shared/ports/Logger';

describe('RotatingSeedChainProvider', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = { warn: jest.fn(), error: jest.fn() };
  });

  it('returns a 64-character hex string', () => {
    const provider = new RotatingSeedChainProvider(10, logger);
    const seed = provider.next();
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns different seeds on consecutive calls', () => {
    const provider = new RotatingSeedChainProvider(10, logger);
    const s1 = provider.next();
    const s2 = provider.next();
    expect(s1).not.toBe(s2);
  });

  it('seeds within same chain verify via SeedChain.verify', () => {
    const provider = new RotatingSeedChainProvider(10, logger);
    const s1 = provider.next();
    const s2 = provider.next();
    // hash(s2) === s1 because seeds are built backwards
    expect(SeedChain.verify(s2, s1)).toBe(true);
  });

  it('does not throw after exhausting the chain length', () => {
    const provider = new RotatingSeedChainProvider(3, logger);
    provider.next(); // 1
    provider.next(); // 2
    provider.next(); // 3 — chain exhausted

    // 4th call triggers rotation, should not throw
    expect(() => provider.next()).not.toThrow();
  });

  it('returns valid seeds after rotation', () => {
    const provider = new RotatingSeedChainProvider(2, logger);
    provider.next();
    provider.next(); // exhausts first chain

    const postRotation = provider.next();
    expect(postRotation).toMatch(/^[0-9a-f]{64}$/);
  });

  it('seeds within the new chain verify after rotation', () => {
    const provider = new RotatingSeedChainProvider(2, logger);
    provider.next();
    provider.next(); // exhausts first chain

    const s1 = provider.next(); // first of new chain
    const s2 = provider.next(); // second of new chain
    expect(SeedChain.verify(s2, s1)).toBe(true);
  });

  it('logs on initialization', () => {
    new RotatingSeedChainProvider(5, logger);
    expect(logger.warn).toHaveBeenCalledWith(
      'Seed chain initialized',
      expect.objectContaining({ chainHash: expect.any(String), chainLength: 5 }),
    );
  });

  it('logs on rotation', () => {
    const provider = new RotatingSeedChainProvider(1, logger);
    (logger.warn as jest.Mock).mockClear();

    provider.next(); // exhausts chain
    provider.next(); // triggers rotation

    expect(logger.warn).toHaveBeenCalledWith(
      'Seed chain rotated',
      expect.objectContaining({ chainHash: expect.any(String), chainLength: 1 }),
    );
  });

  it('can rotate multiple times', () => {
    const provider = new RotatingSeedChainProvider(1, logger);
    // Each call exhausts a 1-length chain, so every other call rotates
    for (let i = 0; i < 20; i++) {
      expect(() => provider.next()).not.toThrow();
    }
  });
});
