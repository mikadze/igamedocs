import { CashoutCalculation } from '../CashoutCalculation';
import { Money } from '@shared/kernel/Money';
import { InvalidCrashPointError } from '@shared/kernel/DomainError';

describe('CashoutCalculation', () => {
  it('calculates payout with 2x multiplier', () => {
    const calc = new CashoutCalculation(Money.fromCents(1000), 2.0);
    expect(calc.payout.toCents()).toBe(2000);
  });

  it('calculates payout with 1.5x multiplier', () => {
    const calc = new CashoutCalculation(Money.fromCents(1000), 1.5);
    expect(calc.payout.toCents()).toBe(1500);
  });

  it('floors fractional cents (1.337x)', () => {
    const calc = new CashoutCalculation(Money.fromCents(1000), 1.337);
    expect(calc.payout.toCents()).toBe(1337);
  });

  it('floors fractional cents (333 * 2.5 = 832.5 -> 832)', () => {
    const calc = new CashoutCalculation(Money.fromCents(333), 2.5);
    expect(calc.payout.toCents()).toBe(832);
  });

  it('returns same amount for 1x multiplier', () => {
    const bet = Money.fromCents(500);
    const calc = new CashoutCalculation(bet, 1.0);
    expect(calc.payout.toCents()).toBe(500);
  });

  it('returns zero payout for zero bet', () => {
    const calc = new CashoutCalculation(Money.zero(), 2.0);
    expect(calc.payout.isZero()).toBe(true);
  });

  it('stores betAmount and cashoutMultiplier', () => {
    const bet = Money.fromCents(1000);
    const calc = new CashoutCalculation(bet, 1.5);
    expect(calc.betAmount.toCents()).toBe(1000);
    expect(calc.cashoutMultiplier).toBe(1.5);
  });

  it('rejects multiplier below 1.0', () => {
    expect(
      () => new CashoutCalculation(Money.fromCents(1000), 0.5),
    ).toThrow('Cashout multiplier must be >= 1.00');
  });

  it('rejects multiplier of 0', () => {
    expect(
      () => new CashoutCalculation(Money.fromCents(1000), 0),
    ).toThrow('Cashout multiplier must be >= 1.00');
  });

  it('rejects NaN multiplier', () => {
    expect(
      () => new CashoutCalculation(Money.fromCents(1000), NaN),
    ).toThrow(InvalidCrashPointError);
  });

  it('rejects Infinity multiplier', () => {
    expect(
      () => new CashoutCalculation(Money.fromCents(1000), Infinity),
    ).toThrow(InvalidCrashPointError);
  });

  it('rejects negative Infinity multiplier', () => {
    expect(
      () => new CashoutCalculation(Money.fromCents(1000), -Infinity),
    ).toThrow(InvalidCrashPointError);
  });

  it('throws a domain error, not a generic Error', () => {
    expect(
      () => new CashoutCalculation(Money.fromCents(1000), 0.5),
    ).toThrow(InvalidCrashPointError);
  });
});
