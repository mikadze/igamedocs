import { Money } from '@shared/kernel/Money';
import {
  SoftSwissWalletAdapter,
  SoftSwissConfig,
} from '@betting/infrastructure/wallet-adapters/SoftSwissWalletAdapter';

describe('SoftSwissWalletAdapter', () => {
  let adapter: SoftSwissWalletAdapter;

  const config: SoftSwissConfig = {
    baseUrl: 'https://stub.softswiss.test',
    casinoId: 'test-casino',
    authToken: 'test-token',
  };

  beforeEach(() => {
    adapter = new SoftSwissWalletAdapter(config);
  });

  // --- debit ---

  describe('debit', () => {
    it('succeeds and reduces balance', async () => {
      const result = await adapter.debit(
        'player-1',
        Money.fromCents(1000),
        'round-1',
        'bet-1',
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.newBalance).toEqual(Money.fromCents(999_000));
        expect(typeof result.transactionId).toBe('string');
      }
    });

    it('returns INSUFFICIENT_FUNDS when amount exceeds balance', async () => {
      const result = await adapter.debit(
        'player-1',
        Money.fromCents(2_000_000),
        'round-1',
        'bet-1',
      );

      expect(result).toEqual({
        success: false,
        error: 'INSUFFICIENT_FUNDS',
      });
    });

    it('tracks cumulative debits', async () => {
      await adapter.debit('player-1', Money.fromCents(400_000), 'r-1', 'b-1');
      await adapter.debit('player-1', Money.fromCents(400_000), 'r-1', 'b-2');

      const balance = await adapter.getBalance('player-1');
      expect(balance).toEqual(Money.fromCents(200_000));
    });

    it('returns INSUFFICIENT_FUNDS after balance is drained', async () => {
      await adapter.debit('player-1', Money.fromCents(1_000_000), 'r-1', 'b-1');

      const result = await adapter.debit(
        'player-1',
        Money.fromCents(1),
        'r-2',
        'b-2',
      );

      expect(result).toEqual({
        success: false,
        error: 'INSUFFICIENT_FUNDS',
      });
    });
  });

  // --- credit ---

  describe('credit', () => {
    it('succeeds and increases balance', async () => {
      const result = await adapter.credit(
        'player-1',
        Money.fromCents(5000),
        'round-1',
        'bet-1',
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.newBalance).toEqual(Money.fromCents(1_005_000));
        expect(typeof result.transactionId).toBe('string');
      }
    });

    it('debit then credit restores balance', async () => {
      await adapter.debit('player-1', Money.fromCents(5000), 'r-1', 'b-1');
      await adapter.credit('player-1', Money.fromCents(5000), 'r-1', 'b-1');

      const balance = await adapter.getBalance('player-1');
      expect(balance).toEqual(Money.fromCents(1_000_000));
    });
  });

  // --- getBalance ---

  describe('getBalance', () => {
    it('returns default balance for new player', async () => {
      const balance = await adapter.getBalance('new-player');
      expect(balance).toEqual(Money.fromCents(1_000_000));
    });

    it('reflects previous debit', async () => {
      await adapter.debit('player-1', Money.fromCents(3000), 'r-1', 'b-1');

      const balance = await adapter.getBalance('player-1');
      expect(balance).toEqual(Money.fromCents(997_000));
    });
  });

  // --- player isolation ---

  describe('player isolation', () => {
    it('tracks separate balances per player', async () => {
      await adapter.debit('player-1', Money.fromCents(100_000), 'r-1', 'b-1');
      await adapter.debit('player-2', Money.fromCents(200_000), 'r-1', 'b-2');

      expect(await adapter.getBalance('player-1')).toEqual(
        Money.fromCents(900_000),
      );
      expect(await adapter.getBalance('player-2')).toEqual(
        Money.fromCents(800_000),
      );
    });
  });
});
