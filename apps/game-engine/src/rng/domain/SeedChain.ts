import { createHash } from 'crypto';

export class SeedChain {
  private readonly seeds: string[];
  private currentIndex: number = 0;

  constructor(terminalSeed: string, length: number) {
    if (length < 1) {
      throw new Error('Seed chain length must be at least 1');
    }

    this.seeds = new Array(length);
    this.seeds[length - 1] = terminalSeed;

    // Build chain backwards: seed[i] = hash(seed[i+1])
    for (let i = length - 2; i >= 0; i--) {
      this.seeds[i] = SeedChain.hash(this.seeds[i + 1]);
    }
  }

  static hash(seed: string): string {
    return createHash('sha256').update(seed).digest('hex');
  }

  next(): string {
    if (this.currentIndex >= this.seeds.length) {
      throw new Error('Seed chain exhausted');
    }
    return this.seeds[this.currentIndex++];
  }

  peek(): string {
    if (this.currentIndex >= this.seeds.length) {
      throw new Error('Seed chain exhausted');
    }
    return this.seeds[this.currentIndex];
  }

  get remaining(): number {
    return this.seeds.length - this.currentIndex;
  }

  static verify(currentSeed: string, previousSeed: string): boolean {
    return SeedChain.hash(currentSeed) === previousSeed;
  }
}
