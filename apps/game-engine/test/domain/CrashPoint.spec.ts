import { CrashPoint } from '@shared/kernel/CrashPoint';
import { InvalidCrashPointError } from '@shared/kernel/DomainError';

describe('CrashPoint', () => {
  it('wraps a value >= 1.00', () => {
    const cp = CrashPoint.of(2.5);
    expect(cp.value).toBe(2.5);
  });

  it('allows exactly 1.00', () => {
    const cp = CrashPoint.of(1.0);
    expect(cp.value).toBe(1.0);
  });

  it('throws for values < 1.00', () => {
    expect(() => CrashPoint.of(0.5)).toThrow(InvalidCrashPointError);
    expect(() => CrashPoint.of(0.99)).toThrow(InvalidCrashPointError);
  });

  it('toDisplay returns 2 decimal places', () => {
    expect(CrashPoint.of(2.5).toDisplay()).toBe('2.50');
    expect(CrashPoint.of(1.0).toDisplay()).toBe('1.00');
    expect(CrashPoint.of(100.123).toDisplay()).toBe('100.12');
  });
});
