import {
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../WalletTransaction';
import { Money } from '@shared/kernel/Money';
import {
  InvalidStateTransition,
  InvalidWalletTransactionError,
} from '@shared/kernel/DomainError';

function createTx(overrides: Partial<{
  id: string;
  playerId: string;
  operatorId: string;
  type: WalletTransactionType;
  requestUuid: string;
  transactionUuid: string;
  referenceTransactionUuid: string | null;
  roundId: string;
  amount: Money;
  currency: string;
}> = {}): WalletTransaction {
  return new WalletTransaction(
    overrides.id ?? 'tx-1',
    overrides.playerId ?? 'player-1',
    overrides.operatorId ?? 'op-1',
    overrides.type ?? WalletTransactionType.BET,
    overrides.requestUuid ?? 'req-1',
    overrides.transactionUuid ?? 'txn-1',
    overrides.referenceTransactionUuid ?? null,
    overrides.roundId ?? 'round-1',
    overrides.amount ?? Money.fromCents(1000),
    overrides.currency ?? 'EUR',
  );
}

describe('WalletTransaction', () => {
  it('starts with PENDING status', () => {
    const tx = createTx();
    expect(tx.status).toBe(WalletTransactionStatus.PENDING);
  });

  describe('complete()', () => {
    it('transitions PENDING -> COMPLETED', () => {
      const tx = createTx();
      tx.complete();
      expect(tx.status).toBe(WalletTransactionStatus.COMPLETED);
    });

    it('throws from COMPLETED state', () => {
      const tx = createTx();
      tx.complete();
      expect(() => tx.complete()).toThrow(InvalidStateTransition);
    });

    it('throws from FAILED state', () => {
      const tx = createTx();
      tx.fail();
      expect(() => tx.complete()).toThrow(InvalidStateTransition);
    });

    it('throws from ROLLED_BACK state', () => {
      const tx = createTx();
      tx.rollback();
      expect(() => tx.complete()).toThrow(InvalidStateTransition);
    });
  });

  describe('fail()', () => {
    it('transitions PENDING -> FAILED', () => {
      const tx = createTx();
      tx.fail();
      expect(tx.status).toBe(WalletTransactionStatus.FAILED);
    });

    it('throws from COMPLETED state', () => {
      const tx = createTx();
      tx.complete();
      expect(() => tx.fail()).toThrow(InvalidStateTransition);
    });

    it('throws from FAILED state', () => {
      const tx = createTx();
      tx.fail();
      expect(() => tx.fail()).toThrow(InvalidStateTransition);
    });
  });

  describe('rollback()', () => {
    it('transitions PENDING -> ROLLED_BACK', () => {
      const tx = createTx();
      tx.rollback();
      expect(tx.status).toBe(WalletTransactionStatus.ROLLED_BACK);
    });

    it('transitions COMPLETED -> ROLLED_BACK', () => {
      const tx = createTx();
      tx.complete();
      tx.rollback();
      expect(tx.status).toBe(WalletTransactionStatus.ROLLED_BACK);
    });

    it('transitions FAILED -> ROLLED_BACK', () => {
      const tx = createTx();
      tx.fail();
      tx.rollback();
      expect(tx.status).toBe(WalletTransactionStatus.ROLLED_BACK);
    });

    it('is idempotent from ROLLED_BACK', () => {
      const tx = createTx();
      tx.rollback();
      tx.rollback();
      expect(tx.status).toBe(WalletTransactionStatus.ROLLED_BACK);
    });
  });

  describe('validation', () => {
    it('requires ROLLBACK type to have referenceTransactionUuid', () => {
      expect(
        () => createTx({ type: WalletTransactionType.ROLLBACK, referenceTransactionUuid: null }),
      ).toThrow(InvalidWalletTransactionError);
    });

    it('allows ROLLBACK with referenceTransactionUuid', () => {
      const tx = createTx({
        type: WalletTransactionType.ROLLBACK,
        referenceTransactionUuid: 'ref-tx-1',
      });
      expect(tx.type).toBe(WalletTransactionType.ROLLBACK);
    });

    it('allows BET without referenceTransactionUuid', () => {
      const tx = createTx({ type: WalletTransactionType.BET, referenceTransactionUuid: null });
      expect(tx.referenceTransactionUuid).toBeNull();
    });

    it('allows WIN with referenceTransactionUuid', () => {
      const tx = createTx({
        type: WalletTransactionType.WIN,
        referenceTransactionUuid: 'ref-tx-1',
      });
      expect(tx.referenceTransactionUuid).toBe('ref-tx-1');
    });

    it('throws for missing id', () => {
      expect(() => createTx({ id: '' })).toThrow(InvalidWalletTransactionError);
    });

    it('throws for missing playerId', () => {
      expect(() => createTx({ playerId: '' })).toThrow(InvalidWalletTransactionError);
    });

    it('throws for missing operatorId', () => {
      expect(() => createTx({ operatorId: '' })).toThrow(InvalidWalletTransactionError);
    });

    it('throws for missing requestUuid', () => {
      expect(() => createTx({ requestUuid: '' })).toThrow(InvalidWalletTransactionError);
    });

    it('throws for missing transactionUuid', () => {
      expect(() => createTx({ transactionUuid: '' })).toThrow(InvalidWalletTransactionError);
    });

    it('throws for missing roundId', () => {
      expect(() => createTx({ roundId: '' })).toThrow(InvalidWalletTransactionError);
    });

    it('throws for invalid currency', () => {
      expect(() => createTx({ currency: 'EU' })).toThrow(InvalidWalletTransactionError);
    });

    it('throws for currency longer than 3 chars', () => {
      expect(() => createTx({ currency: 'EURO' })).toThrow(InvalidWalletTransactionError);
    });
  });
});
