import { Money } from '@shared/kernel/Money';
import { InvalidMoneyError } from '@shared/kernel/DomainError';

describe('Money', () => {
  describe('factories', () => {
    it('creates from cents', () => {
      const m = Money.fromCents(500);
      expect(m.toCents()).toBe(500);
    });

    it('creates from dollars', () => {
      const m = Money.fromDollars(5.0);
      expect(m.toCents()).toBe(500);
    });

    it('rounds fromDollars to nearest cent', () => {
      const m = Money.fromDollars(5.555);
      expect(m.toCents()).toBe(556);
    });

    it('creates zero', () => {
      const m = Money.zero();
      expect(m.toCents()).toBe(0);
      expect(m.isZero()).toBe(true);
    });
  });

  describe('arithmetic', () => {
    it('adds two Money values', () => {
      const a = Money.fromCents(300);
      const b = Money.fromCents(200);
      expect(a.add(b).toCents()).toBe(500);
    });

    it('subtracts two Money values', () => {
      const a = Money.fromCents(500);
      const b = Money.fromCents(200);
      expect(a.subtract(b).toCents()).toBe(300);
    });

    it('multiplyByMultiplier floors the result', () => {
      const m = Money.fromCents(1000);
      // 1000 * 2.57 = 2570
      expect(m.multiplyByMultiplier(2.57).toCents()).toBe(2570);
    });

    it('multiplyByMultiplier floors fractional cents', () => {
      const m = Money.fromCents(333);
      // 333 * 1.5 = 499.5 → floor → 499
      expect(m.multiplyByMultiplier(1.5).toCents()).toBe(499);
    });

    it('multiplyByMultiplier with 1.0 returns same amount', () => {
      const m = Money.fromCents(1000);
      expect(m.multiplyByMultiplier(1.0).toCents()).toBe(1000);
    });
  });

  describe('comparisons', () => {
    it('isGreaterThan', () => {
      expect(Money.fromCents(500).isGreaterThan(Money.fromCents(300))).toBe(true);
      expect(Money.fromCents(300).isGreaterThan(Money.fromCents(500))).toBe(false);
      expect(Money.fromCents(300).isGreaterThan(Money.fromCents(300))).toBe(false);
    });

    it('isLessThan', () => {
      expect(Money.fromCents(300).isLessThan(Money.fromCents(500))).toBe(true);
      expect(Money.fromCents(500).isLessThan(Money.fromCents(300))).toBe(false);
    });

    it('equals', () => {
      expect(Money.fromCents(500).equals(Money.fromCents(500))).toBe(true);
      expect(Money.fromCents(500).equals(Money.fromCents(300))).toBe(false);
    });
  });

  describe('display', () => {
    it('formats as dollars with 2 decimals', () => {
      expect(Money.fromCents(1050).toDisplay()).toBe('10.50');
      expect(Money.fromCents(0).toDisplay()).toBe('0.00');
      expect(Money.fromCents(1).toDisplay()).toBe('0.01');
    });
  });

  describe('validation', () => {
    it('rejects negative cents', () => {
      expect(() => Money.fromCents(-1)).toThrow(InvalidMoneyError);
    });

    it('rejects NaN', () => {
      expect(() => Money.fromCents(NaN)).toThrow(InvalidMoneyError);
    });

    it('rejects Infinity', () => {
      expect(() => Money.fromCents(Infinity)).toThrow(InvalidMoneyError);
    });

    it('rejects negative Infinity', () => {
      expect(() => Money.fromCents(-Infinity)).toThrow(InvalidMoneyError);
    });

    it('rejects non-integer', () => {
      expect(() => Money.fromCents(10.5)).toThrow(InvalidMoneyError);
    });

    it('subtract rejects result that would be negative', () => {
      expect(() => Money.fromCents(100).subtract(Money.fromCents(200))).toThrow(InvalidMoneyError);
    });
  });
});
