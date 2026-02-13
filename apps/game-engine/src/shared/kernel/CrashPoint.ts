import { InvalidCrashPointError } from '@shared/kernel/DomainError';

export class CrashPoint {
  private constructor(readonly value: number) {
    if (value < 1.0) {
      throw new InvalidCrashPointError(`Crash point must be >= 1.00, got ${value}`);
    }
  }

  static of(value: number): CrashPoint {
    return new CrashPoint(value);
  }

  toDisplay(): string {
    return this.value.toFixed(2);
  }
}
