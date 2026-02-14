import { RandomClientSeedProvider } from '@engine/infrastructure/RandomClientSeedProvider';

describe('RandomClientSeedProvider', () => {
  let provider: RandomClientSeedProvider;

  beforeEach(() => {
    provider = new RandomClientSeedProvider();
  });

  it('returns a 64-character hex string', () => {
    const seed = provider.next();
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns different values on consecutive calls', () => {
    const seeds = new Set<string>();
    for (let i = 0; i < 10; i++) {
      seeds.add(provider.next());
    }
    expect(seeds.size).toBe(10);
  });
});
