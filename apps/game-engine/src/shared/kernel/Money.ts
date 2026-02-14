import { InvalidMoneyError } from '@shared/kernel/DomainError';

export class Money {
  private constructor(private readonly cents: number) {
    if (!Number.isInteger(cents)) throw new InvalidMoneyError('Must be integer cents');
    if (!Number.isFinite(cents)) throw new InvalidMoneyError('Must be finite');
    if (cents < 0) throw new InvalidMoneyError('Must be non-negative');
  }

  static fromCents(cents: number): Money {
    return new Money(cents);
  }

  static fromDollars(dollars: number): Money {
    return new Money(Math.round(dollars * 100));
  }

  static zero(): Money {
    return new Money(0);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  multiplyByMultiplier(multiplier: number): Money {
    return new Money(Math.floor(this.cents * multiplier));
  }

  isGreaterThan(other: Money): boolean {
    return this.cents > other.cents;
  }

  isLessThan(other: Money): boolean {
    return this.cents < other.cents;
  }

  isZero(): boolean {
    return this.cents === 0;
  }

  toCents(): number {
    return this.cents;
  }

  toDisplay(): string {
    return (this.cents / 100).toFixed(2);
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }
}
