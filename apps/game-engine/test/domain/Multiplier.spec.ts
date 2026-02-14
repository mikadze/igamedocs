import { Multiplier } from '@engine/domain/Multiplier';

describe('Multiplier', () => {
  it('at(0) equals 1.0', () => {
    const m = Multiplier.at(0);
    expect(m.value).toBe(1.0);
  });

  it('grows over time with default rate', () => {
    const m1 = Multiplier.at(0);
    const m2 = Multiplier.at(5000);
    const m3 = Multiplier.at(10000);
    expect(m2.value).toBeGreaterThan(m1.value);
    expect(m3.value).toBeGreaterThan(m2.value);
  });

  it('is deterministic for same input', () => {
    const a = Multiplier.at(5000);
    const b = Multiplier.at(5000);
    expect(a.value).toBe(b.value);
  });

  it('accepts custom growth rate', () => {
    const slow = Multiplier.at(10000, 0.00003);
    const fast = Multiplier.at(10000, 0.0001);
    expect(fast.value).toBeGreaterThan(slow.value);
  });

  it('toDisplay formats to 2 decimal places', () => {
    const m = Multiplier.at(0);
    expect(m.toDisplay()).toBe('1.00');
  });

  it('follows exponential curve: e^(rate * ms)', () => {
    const rate = 0.00006;
    const ms = 10000;
    const expected = Math.exp(rate * ms);
    expect(Multiplier.at(ms, rate).value).toBeCloseTo(expected, 10);
  });
});
