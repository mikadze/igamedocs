import { Round } from '@engine/domain/Round';
import { RoundState } from '@engine/domain/RoundState';
import { CrashPoint } from '@shared/kernel/CrashPoint';
import { Bet } from '@engine/domain/Bet';
import { BetStatus } from '@engine/domain/BetStatus';
import { Money } from '@shared/kernel/Money';
import { InvalidStateTransition } from '@shared/kernel/DomainError';

describe('Round', () => {
  const makeRound = (crashAt = 2.0) =>
    new Round('round-1', CrashPoint.of(crashAt), 'hashed-seed-abc');

  const makeBet = (id = 'bet-1', autoCashout?: number) =>
    new Bet(id, 'player-1', 'round-1', Money.fromCents(1000), autoCashout);

  describe('state transitions', () => {
    it('starts in WAITING', () => {
      const round = makeRound();
      expect(round.state).toBe(RoundState.WAITING);
    });

    it('WAITING → BETTING', () => {
      const round = makeRound();
      round.openBetting();
      expect(round.state).toBe(RoundState.BETTING);
    });

    it('BETTING → RUNNING', () => {
      const round = makeRound();
      round.openBetting();
      round.startFlying();
      expect(round.state).toBe(RoundState.RUNNING);
    });

    it('RUNNING → CRASHED on tick', () => {
      const round = makeRound(2.0);
      round.openBetting();
      round.startFlying();
      const crashed = round.tick(2.0);
      expect(crashed).toBe(true);
      expect(round.state).toBe(RoundState.CRASHED);
    });

    it('rejects invalid transitions', () => {
      const round = makeRound();
      expect(() => round.startFlying()).toThrow(InvalidStateTransition);
    });

    it('cannot open betting twice', () => {
      const round = makeRound();
      round.openBetting();
      expect(() => round.openBetting()).toThrow(InvalidStateTransition);
    });
  });

  describe('addBet', () => {
    it('adds and activates bet during BETTING', () => {
      const round = makeRound();
      round.openBetting();
      const bet = makeBet();
      round.addBet(bet);
      expect(bet.status).toBe(BetStatus.ACTIVE);
      expect(round.bets.size).toBe(1);
    });

    it('rejects bet when not BETTING', () => {
      const round = makeRound();
      expect(() => round.addBet(makeBet())).toThrow(InvalidStateTransition);
    });

    it('rejects duplicate bet IDs', () => {
      const round = makeRound();
      round.openBetting();
      round.addBet(makeBet('dup'));
      expect(() => round.addBet(makeBet('dup'))).toThrow();
    });
  });

  describe('tick', () => {
    it('returns false when multiplier < crash point', () => {
      const round = makeRound(3.0);
      round.openBetting();
      round.startFlying();
      expect(round.tick(1.5)).toBe(false);
      expect(round.state).toBe(RoundState.RUNNING);
    });

    it('updates currentMultiplier', () => {
      const round = makeRound(5.0);
      round.openBetting();
      round.startFlying();
      round.tick(2.5);
      expect(round.currentMultiplier).toBe(2.5);
    });

    it('crashes and settles all active bets as lost', () => {
      const round = makeRound(2.0);
      round.openBetting();
      const bet1 = makeBet('b1');
      const bet2 = makeBet('b2');
      round.addBet(bet1);
      round.addBet(bet2);
      round.startFlying();
      round.tick(2.0);
      expect(bet1.status).toBe(BetStatus.LOST);
      expect(bet2.status).toBe(BetStatus.LOST);
    });

    it('throws when not RUNNING', () => {
      const round = makeRound();
      expect(() => round.tick(1.5)).toThrow(InvalidStateTransition);
    });
  });

  describe('cashout', () => {
    it('cashes out a bet during RUNNING', () => {
      const round = makeRound(5.0);
      round.openBetting();
      round.addBet(makeBet('b1'));
      round.startFlying();
      round.tick(2.0);
      const payout = round.cashout('b1');
      expect(payout.toCents()).toBe(2000);
    });

    it('throws when not RUNNING', () => {
      const round = makeRound();
      round.openBetting();
      round.addBet(makeBet('b1'));
      expect(() => round.cashout('b1')).toThrow(InvalidStateTransition);
    });

    it('throws for unknown bet ID', () => {
      const round = makeRound(5.0);
      round.openBetting();
      round.startFlying();
      expect(() => round.cashout('nonexistent')).toThrow();
    });
  });

  describe('instant crash (1.00x)', () => {
    it('crashes immediately on first tick', () => {
      const round = makeRound(1.0);
      round.openBetting();
      const bet = makeBet();
      round.addBet(bet);
      round.startFlying();
      const crashed = round.tick(1.0);
      expect(crashed).toBe(true);
      expect(bet.status).toBe(BetStatus.LOST);
    });
  });

  describe('boundary bets', () => {
    it('cashout just before crash gives correct payout', () => {
      const round = makeRound(3.0);
      round.openBetting();
      round.addBet(makeBet('b1'));
      round.startFlying();
      round.tick(2.99);
      const payout = round.cashout('b1');
      // 1000 * 2.99 = 2990
      expect(payout.toCents()).toBe(2990);
    });

    it('cashed-out bets are not settled as lost on crash', () => {
      const round = makeRound(3.0);
      round.openBetting();
      const b1 = makeBet('b1');
      const b2 = makeBet('b2');
      round.addBet(b1);
      round.addBet(b2);
      round.startFlying();
      round.tick(2.5);
      round.cashout('b1');
      round.tick(3.0); // crash
      expect(b1.status).toBe(BetStatus.WON);
      expect(b2.status).toBe(BetStatus.LOST);
    });
  });

  describe('auto-cashout', () => {
    it('getAutoCashouts returns bets that should auto-cashout', () => {
      const round = makeRound(5.0);
      round.openBetting();
      round.addBet(makeBet('b1', 2.0));
      round.addBet(makeBet('b2', 3.0));
      round.addBet(makeBet('b3')); // no auto-cashout
      round.startFlying();
      round.tick(2.0);
      const autoCashouts = round.bets.getAutoCashouts(2.0);
      expect(autoCashouts).toHaveLength(1);
      expect(autoCashouts[0].id).toBe('b1');
    });
  });

  describe('max bet amounts', () => {
    it('handles large bet amounts correctly', () => {
      const round = makeRound(10.0);
      round.openBetting();
      const bigBet = new Bet('big', 'player', 'round-1', Money.fromCents(10000000)); // $100,000
      round.addBet(bigBet);
      round.startFlying();
      round.tick(5.0);
      const payout = round.cashout('big');
      expect(payout.toCents()).toBe(50000000); // $500,000
    });
  });
});
