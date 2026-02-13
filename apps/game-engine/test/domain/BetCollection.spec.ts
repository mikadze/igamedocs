import { BetCollection } from '@engine/domain/BetCollection';
import { Bet } from '@engine/domain/Bet';
import { BetStatus } from '@engine/domain/BetStatus';
import { Money } from '@shared/kernel/Money';

describe('BetCollection', () => {
  const makeBet = (id: string, autoCashout?: number) => {
    const bet = new Bet(id, 'player-1', 'round-1', Money.fromCents(1000), autoCashout);
    bet.activate();
    return bet;
  };

  it('adds and retrieves bets', () => {
    const col = new BetCollection();
    const bet = makeBet('b1');
    col.add(bet);
    expect(col.getById('b1')).toBe(bet);
    expect(col.size).toBe(1);
  });

  it('rejects duplicate IDs', () => {
    const col = new BetCollection();
    col.add(makeBet('b1'));
    expect(() => col.add(makeBet('b1'))).toThrow();
  });

  it('getActive returns only active bets', () => {
    const col = new BetCollection();
    const b1 = makeBet('b1');
    const b2 = makeBet('b2');
    col.add(b1);
    col.add(b2);
    b1.cashout(2.0); // now WON
    expect(col.getActive()).toHaveLength(1);
    expect(col.getActive()[0].id).toBe('b2');
  });

  it('settleAll marks all active bets as LOST', () => {
    const col = new BetCollection();
    const b1 = makeBet('b1');
    const b2 = makeBet('b2');
    const b3 = makeBet('b3');
    col.add(b1);
    col.add(b2);
    col.add(b3);
    b1.cashout(2.0); // WON before settle
    col.settleAll();
    expect(b1.status).toBe(BetStatus.WON); // unchanged
    expect(b2.status).toBe(BetStatus.LOST);
    expect(b3.status).toBe(BetStatus.LOST);
  });

  it('getAutoCashouts returns bets that should auto-cashout at given multiplier', () => {
    const col = new BetCollection();
    col.add(makeBet('b1', 2.0));
    col.add(makeBet('b2', 3.0));
    col.add(makeBet('b3')); // no auto-cashout
    const cashouts = col.getAutoCashouts(2.0);
    expect(cashouts).toHaveLength(1);
    expect(cashouts[0].id).toBe('b1');
  });

  it('getAll returns all bets', () => {
    const col = new BetCollection();
    col.add(makeBet('b1'));
    col.add(makeBet('b2'));
    expect(col.getAll()).toHaveLength(2);
  });

  it('returns undefined for unknown bet ID', () => {
    const col = new BetCollection();
    expect(col.getById('nonexistent')).toBeUndefined();
  });
});
