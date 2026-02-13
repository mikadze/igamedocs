const DEFAULT_GROWTH_RATE = 0.00006;

export class Multiplier {
  private constructor(readonly value: number) {}

  static at(elapsedMs: number, growthRate: number = DEFAULT_GROWTH_RATE): Multiplier {
    const value = Math.exp(growthRate * elapsedMs);
    return new Multiplier(value);
  }

  static valueAt(elapsedMs: number, growthRate: number = DEFAULT_GROWTH_RATE): number {
    return Math.exp(growthRate * elapsedMs);
  }

  toDisplay(): string {
    return this.value.toFixed(2);
  }
}
