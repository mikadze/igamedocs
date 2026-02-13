import { Bet } from '@engine/domain/Bet';
import { BetStatus } from '@engine/domain/BetStatus';
import { Money } from '@shared/kernel/Money';
import { BetNotActiveError, InvalidStateTransition } from '@shared/kernel/DomainError';

describe('Bet', () => {
  const makeBet = (opts?: { autoCashout?: number }) =>
    new Bet('bet-1', 'player-1', 'round-1', Money.fromCents(1000), opts?.autoCashout);

  describe('activate', () => {
    it('transitions from PENDING to ACTIVE', () => {
      const bet = makeBet();
      expect(bet.status).toBe(BetStatus.PENDING);
      bet.activate();
      expect(bet.status).toBe(BetStatus.ACTIVE);
    });

    it('throws if already active', () => {
      const bet = makeBet();
      bet.activate();
      expect(() => bet.activate()).toThrow(InvalidStateTransition);
    });
  });

  describe('cashout', () => {
    it('transitions to WON and returns payout', () => {
      const bet = makeBet();
      bet.activate();
      const payout = bet.cashout(2.5);
      expect(bet.status).toBe(BetStatus.WON);
      expect(payout.toCents()).toBe(2500);
      expect(bet.cashoutMultiplier).toBe(2.5);
      expect(bet.payout?.toCents()).toBe(2500);
    });

    it('floors payout (preserves house edge)', () => {
      const bet = new Bet('bet-2', 'player-1', 'round-1', Money.fromCents(333));
      bet.activate();
      const payout = bet.cashout(1.5);
      // 333 * 1.5 = 499.5 → floor → 499
      expect(payout.toCents()).toBe(499);
    });

    it('throws BetNotActiveError if not active', () => {
      const bet = makeBet();
      expect(() => bet.cashout(2.0)).toThrow(BetNotActiveError);
    });

    it('throws BetNotActiveError if already won', () => {
      const bet = makeBet();
      bet.activate();
      bet.cashout(2.0);
      expect(() => bet.cashout(3.0)).toThrow(BetNotActiveError);
    });

    it('throws BetNotActiveError if already lost', () => {
      const bet = makeBet();
      bet.activate();
      bet.lose();
      expect(() => bet.cashout(2.0)).toThrow(BetNotActiveError);
    });
  });

  describe('lose', () => {
    it('transitions to LOST with zero payout', () => {
      const bet = makeBet();
      bet.activate();
      bet.lose();
      expect(bet.status).toBe(BetStatus.LOST);
      expect(bet.payout?.isZero()).toBe(true);
    });

    it('throws if not active', () => {
      const bet = makeBet();
      expect(() => bet.lose()).toThrow(BetNotActiveError);
    });
  });

  describe('shouldAutoCashout', () => {
    it('returns true when multiplier reaches auto-cashout threshold', () => {
      const bet = makeBet({ autoCashout: 2.0 });
      expect(bet.shouldAutoCashout(2.0)).toBe(true);
      expect(bet.shouldAutoCashout(2.5)).toBe(true);
    });

    it('returns false when multiplier is below threshold', () => {
      const bet = makeBet({ autoCashout: 2.0 });
      expect(bet.shouldAutoCashout(1.99)).toBe(false);
    });

    it('returns false when no auto-cashout is set', () => {
      const bet = makeBet();
      expect(bet.shouldAutoCashout(100.0)).toBe(false);
    });
  });
});
