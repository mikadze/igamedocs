import { Money } from '@shared/kernel/Money';
import { InvalidMoneyError } from '@shared/kernel/DomainError';

describe('Money', () => {
  describe('fromCents', () => {
    it('creates Money from integer cents', () => {
      expect(Money.fromCents(500).toCents()).toBe(500);
    });

    it('rejects negative cents', () => {
      expect(() => Money.fromCents(-1)).toThrow(InvalidMoneyError);
    });

    it('rejects non-integer cents', () => {
      expect(() => Money.fromCents(1.5)).toThrow(InvalidMoneyError);
    });

    it('rejects Infinity', () => {
      expect(() => Money.fromCents(Infinity)).toThrow(InvalidMoneyError);
    });

    it('rejects NaN', () => {
      expect(() => Money.fromCents(NaN)).toThrow(InvalidMoneyError);
    });
  });

  describe('fromDollars', () => {
    it('converts dollars to cents', () => {
      expect(Money.fromDollars(5.50).toCents()).toBe(550);
    });

    it('rounds half-cents using Math.round', () => {
      expect(Money.fromDollars(5.555).toCents()).toBe(556);
    });

    it('handles whole dollars', () => {
      expect(Money.fromDollars(10).toCents()).toBe(1000);
    });
  });

  describe('zero', () => {
    it('creates zero Money', () => {
      const zero = Money.zero();
      expect(zero.toCents()).toBe(0);
      expect(zero.isZero()).toBe(true);
    });
  });

  describe('arithmetic', () => {
    it('adds two Money values', () => {
      const result = Money.fromCents(100).add(Money.fromCents(200));
      expect(result.toCents()).toBe(300);
    });

    it('subtracts two Money values', () => {
      const result = Money.fromCents(300).subtract(Money.fromCents(100));
      expect(result.toCents()).toBe(200);
    });

    it('throws when subtraction results in negative', () => {
      expect(() => Money.fromCents(100).subtract(Money.fromCents(200))).toThrow(InvalidMoneyError);
    });
  });

  describe('multiplyByMultiplier', () => {
    it('multiplies correctly', () => {
      expect(Money.fromCents(100).multiplyByMultiplier(2.5).toCents()).toBe(250);
    });

    it('floors the result (house edge preserved)', () => {
      expect(Money.fromCents(100).multiplyByMultiplier(1.337).toCents()).toBe(133);
    });

    it('floors fractional results down', () => {
      expect(Money.fromCents(333).multiplyByMultiplier(2.5).toCents()).toBe(832);
    });
  });

  describe('comparisons', () => {
    it('isGreaterThan returns true when greater', () => {
      expect(Money.fromCents(200).isGreaterThan(Money.fromCents(100))).toBe(true);
    });

    it('isGreaterThan returns false when equal', () => {
      expect(Money.fromCents(100).isGreaterThan(Money.fromCents(100))).toBe(false);
    });

    it('isLessThan returns true when less', () => {
      expect(Money.fromCents(100).isLessThan(Money.fromCents(200))).toBe(true);
    });

    it('equals returns true for same amount', () => {
      expect(Money.fromCents(100).equals(Money.fromCents(100))).toBe(true);
    });

    it('equals returns false for different amounts', () => {
      expect(Money.fromCents(100).equals(Money.fromCents(200))).toBe(false);
    });
  });

  describe('toDisplay', () => {
    it('formats cents as dollars with two decimal places', () => {
      expect(Money.fromCents(550).toDisplay()).toBe('5.50');
    });

    it('formats zero correctly', () => {
      expect(Money.zero().toDisplay()).toBe('0.00');
    });

    it('formats large amounts', () => {
      expect(Money.fromCents(100000).toDisplay()).toBe('1000.00');
    });
  });
});
