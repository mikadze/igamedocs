import { Bet } from '@engine/domain/Bet';
import { Money } from '@shared/kernel/Money';
import { InMemoryBetStore } from '@betting/infrastructure/InMemoryBetStore';

describe('InMemoryBetStore', () => {
  let store: InMemoryBetStore;

  const makeBet = (id: string, roundId: string): Bet =>
    new Bet(id, 'player-1', roundId, Money.fromCents(1000));

  beforeEach(() => {
    store = new InMemoryBetStore();
  });

  // --- add + getById ---

  describe('add / getById', () => {
    it('stores and retrieves a bet by ID', () => {
      const bet = makeBet('b-1', 'r-1');
      store.add(bet);
      expect(store.getById('b-1')).toBe(bet);
    });

    it('returns undefined for unknown ID', () => {
      expect(store.getById('nonexistent')).toBeUndefined();
    });

    it('overwrites if same ID is added twice', () => {
      const bet1 = makeBet('b-1', 'r-1');
      const bet2 = makeBet('b-1', 'r-2');
      store.add(bet1);
      store.add(bet2);
      expect(store.getById('b-1')).toBe(bet2);
    });

    it('updates round index when overwriting with different roundId', () => {
      store.add(makeBet('b-1', 'r-1'));
      expect(store.getByRound('r-1')).toHaveLength(1);

      store.add(makeBet('b-1', 'r-2'));
      expect(store.getByRound('r-1')).toHaveLength(0);
      expect(store.getByRound('r-2')).toHaveLength(1);
      expect(store.getByRound('r-2')[0].id).toBe('b-1');
    });
  });

  // --- findByIdempotencyKey ---

  describe('findByIdempotencyKey', () => {
    it('finds bet by idempotencyKey', () => {
      const bet = new Bet('b-1', 'player-1', 'r-1', Money.fromCents(1000), undefined, 'idem-1');
      store.add(bet);
      expect(store.findByIdempotencyKey('idem-1')).toBe(bet);
    });

    it('returns undefined for unknown idempotencyKey', () => {
      expect(store.findByIdempotencyKey('nonexistent')).toBeUndefined();
    });
  });

  // --- getByRound ---

  describe('getByRound', () => {
    it('returns only bets matching the round', () => {
      store.add(makeBet('b-1', 'r-1'));
      store.add(makeBet('b-2', 'r-1'));
      store.add(makeBet('b-3', 'r-2'));

      const result = store.getByRound('r-1');
      expect(result).toHaveLength(2);
      expect(result.map((b) => b.id).sort()).toEqual(['b-1', 'b-2']);
    });

    it('returns empty array when no bets match', () => {
      store.add(makeBet('b-1', 'r-1'));
      expect(store.getByRound('r-999')).toEqual([]);
    });

    it('returns empty array on empty store', () => {
      expect(store.getByRound('r-1')).toEqual([]);
    });
  });

  // --- getActiveByRound ---

  describe('getActiveByRound', () => {
    it('returns only ACTIVE bets for the round', () => {
      const active = makeBet('b-1', 'r-1');
      active.activate();

      const pending = makeBet('b-2', 'r-1');

      const won = makeBet('b-3', 'r-1');
      won.activate();
      won.cashout(2.0);

      const lost = makeBet('b-4', 'r-1');
      lost.activate();
      lost.lose();

      store.add(active);
      store.add(pending);
      store.add(won);
      store.add(lost);

      const result = store.getActiveByRound('r-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('b-1');
    });

    it('does not return active bets from other rounds', () => {
      const bet = makeBet('b-1', 'r-2');
      bet.activate();
      store.add(bet);

      expect(store.getActiveByRound('r-1')).toEqual([]);
    });

    it('returns empty array when no active bets exist', () => {
      store.add(makeBet('b-1', 'r-1')); // PENDING
      expect(store.getActiveByRound('r-1')).toEqual([]);
    });
  });

  // --- clearRound ---

  describe('clearRound', () => {
    it('removes all bets for the given round', () => {
      store.add(makeBet('b-1', 'r-1'));
      store.add(makeBet('b-2', 'r-1'));
      store.add(makeBet('b-3', 'r-2'));

      store.clearRound('r-1');

      expect(store.getByRound('r-1')).toEqual([]);
      expect(store.getById('b-1')).toBeUndefined();
      expect(store.getById('b-2')).toBeUndefined();
    });

    it('does not affect bets from other rounds', () => {
      store.add(makeBet('b-1', 'r-1'));
      store.add(makeBet('b-2', 'r-2'));

      store.clearRound('r-1');

      expect(store.getById('b-2')).toBeDefined();
      expect(store.getByRound('r-2')).toHaveLength(1);
    });

    it('is a no-op for unknown roundId', () => {
      store.add(makeBet('b-1', 'r-1'));

      store.clearRound('r-999');

      expect(store.getById('b-1')).toBeDefined();
      expect(store.getByRound('r-1')).toHaveLength(1);
    });

    it('allows adding bets to a round after clearing it', () => {
      store.add(makeBet('b-1', 'r-1'));
      store.clearRound('r-1');

      const newBet = makeBet('b-2', 'r-1');
      store.add(newBet);

      expect(store.getByRound('r-1')).toHaveLength(1);
      expect(store.getById('b-2')).toBe(newBet);
    });
  });
});
