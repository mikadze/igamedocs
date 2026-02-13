import { SeedPair } from '@rng/domain/SeedPair';
import { InvalidSeedError } from '@shared/kernel/DomainError';

describe('SeedPair', () => {
  const validServerSeed = 'a'.repeat(64);

  it('creates a valid seed pair', () => {
    const pair = new SeedPair(validServerSeed, 'client-seed');
    expect(pair.serverSeed).toBe(validServerSeed);
    expect(pair.clientSeed).toBe('client-seed');
  });

  it('is immutable (frozen)', () => {
    const pair = new SeedPair(validServerSeed, 'client-seed');
    expect(Object.isFrozen(pair)).toBe(true);
  });

  it('rejects server seed that is not 64 hex chars', () => {
    expect(() => new SeedPair('short', 'client')).toThrow(InvalidSeedError);
    expect(() => new SeedPair('g'.repeat(64), 'client')).toThrow(InvalidSeedError);
    expect(() => new SeedPair('a'.repeat(63), 'client')).toThrow(InvalidSeedError);
  });

  it('rejects empty client seed', () => {
    expect(() => new SeedPair(validServerSeed, '')).toThrow(InvalidSeedError);
    expect(() => new SeedPair(validServerSeed, '   ')).toThrow(InvalidSeedError);
  });
});
