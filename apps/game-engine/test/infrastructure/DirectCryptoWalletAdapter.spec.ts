import { Money } from '@shared/kernel/Money';
import { DirectCryptoWalletAdapter } from '@betting/infrastructure/wallet-adapters/DirectCryptoWalletAdapter';

describe('DirectCryptoWalletAdapter', () => {
  let adapter: DirectCryptoWalletAdapter;

  beforeEach(() => {
    adapter = new DirectCryptoWalletAdapter();
  });

  describe('debit', () => {
    it('always returns success', async () => {
      const result = await adapter.debit(
        'player-1',
        Money.fromCents(5000),
        'round-1',
        'bet-1',
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.transactionId).toBe('string');
        expect(result.newBalance).toEqual(Money.fromCents(1_000_000));
      }
    });

    it('returns unique transaction IDs', async () => {
      const r1 = await adapter.debit('p-1', Money.fromCents(100), 'r-1', 'b-1');
      const r2 = await adapter.debit('p-1', Money.fromCents(100), 'r-1', 'b-2');

      expect(r1.success && r2.success).toBe(true);
      if (r1.success && r2.success) {
        expect(r1.transactionId).not.toBe(r2.transactionId);
      }
    });
  });

  describe('credit', () => {
    it('always returns success', async () => {
      const result = await adapter.credit(
        'player-1',
        Money.fromCents(10_000),
        'round-1',
        'bet-1',
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.transactionId).toBe('string');
        expect(result.newBalance).toEqual(Money.fromCents(1_000_000));
      }
    });
  });

  describe('getBalance', () => {
    it('returns fixed default balance', async () => {
      const balance = await adapter.getBalance('any-player');
      expect(balance).toEqual(Money.fromCents(1_000_000));
    });
  });
});
