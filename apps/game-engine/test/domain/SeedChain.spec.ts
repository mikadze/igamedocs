import { SeedChain } from '@rng/domain/SeedChain';

describe('SeedChain', () => {
  const terminalSeed = 'a'.repeat(64);

  it('creates a chain of specified length', () => {
    const chain = new SeedChain(terminalSeed, 5);
    expect(chain.remaining).toBe(5);
  });

  it('next() returns seeds in order', () => {
    const chain = new SeedChain(terminalSeed, 3);
    const s0 = chain.next();
    const s1 = chain.next();
    const s2 = chain.next();
    expect(s0).not.toBe(s1);
    expect(s1).not.toBe(s2);
  });

  it('last seed in chain is the terminal seed', () => {
    const chain = new SeedChain(terminalSeed, 3);
    chain.next(); // s0
    chain.next(); // s1
    const last = chain.next(); // s2 = terminal
    expect(last).toBe(terminalSeed);
  });

  it('throws when chain is exhausted', () => {
    const chain = new SeedChain(terminalSeed, 1);
    chain.next();
    expect(() => chain.next()).toThrow('Seed chain exhausted');
  });

  it('peek returns current seed without advancing', () => {
    const chain = new SeedChain(terminalSeed, 3);
    const peeked = chain.peek();
    const next = chain.next();
    expect(peeked).toBe(next);
  });

  it('remaining decreases as seeds are consumed', () => {
    const chain = new SeedChain(terminalSeed, 3);
    expect(chain.remaining).toBe(3);
    chain.next();
    expect(chain.remaining).toBe(2);
    chain.next();
    expect(chain.remaining).toBe(1);
  });

  describe('verify', () => {
    it('hash(seed[i+1]) === seed[i]', () => {
      const chain = new SeedChain(terminalSeed, 5);
      const seeds: string[] = [];
      for (let i = 0; i < 5; i++) {
        seeds.push(chain.next());
      }

      // Each seed verifies against the previous one
      for (let i = 1; i < seeds.length; i++) {
        expect(SeedChain.verify(seeds[i], seeds[i - 1])).toBe(true);
      }
    });

    it('rejects invalid seed pair', () => {
      expect(SeedChain.verify('invalid', 'also-invalid')).toBe(false);
    });
  });

  it('rejects length < 1', () => {
    expect(() => new SeedChain(terminalSeed, 0)).toThrow();
  });
});
