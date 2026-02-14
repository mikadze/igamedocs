import { RoundState, canTransition } from '@engine/domain/RoundState';

describe('RoundState', () => {
  it('allows WAITING → BETTING', () => {
    expect(canTransition(RoundState.WAITING, RoundState.BETTING)).toBe(true);
  });

  it('allows BETTING → RUNNING', () => {
    expect(canTransition(RoundState.BETTING, RoundState.RUNNING)).toBe(true);
  });

  it('allows RUNNING → CRASHED', () => {
    expect(canTransition(RoundState.RUNNING, RoundState.CRASHED)).toBe(true);
  });

  it('rejects WAITING → RUNNING (skip)', () => {
    expect(canTransition(RoundState.WAITING, RoundState.RUNNING)).toBe(false);
  });

  it('rejects CRASHED → anything', () => {
    expect(canTransition(RoundState.CRASHED, RoundState.WAITING)).toBe(false);
    expect(canTransition(RoundState.CRASHED, RoundState.BETTING)).toBe(false);
    expect(canTransition(RoundState.CRASHED, RoundState.RUNNING)).toBe(false);
  });

  it('rejects backwards transitions', () => {
    expect(canTransition(RoundState.RUNNING, RoundState.BETTING)).toBe(false);
    expect(canTransition(RoundState.BETTING, RoundState.WAITING)).toBe(false);
  });
});
