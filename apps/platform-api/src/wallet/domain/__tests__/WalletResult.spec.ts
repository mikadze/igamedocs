import { Money } from '@shared/kernel/Money';
import {
  WalletResult,
  WalletErrorCode,
  isWalletSuccess,
  isWalletError,
} from '../WalletResult';

describe('WalletResult', () => {
  const successResult: WalletResult = {
    success: true,
    balance: Money.fromCents(5000),
  };

  const successWithTxId: WalletResult = {
    success: true,
    balance: Money.fromCents(5000),
    operatorTxId: 'op-tx-123',
  };

  const errorResult: WalletResult = {
    success: false,
    error: 'INSUFFICIENT_FUNDS',
  };

  describe('isWalletSuccess', () => {
    it('returns true for success result', () => {
      expect(isWalletSuccess(successResult)).toBe(true);
    });

    it('returns true for success with operatorTxId', () => {
      expect(isWalletSuccess(successWithTxId)).toBe(true);
    });

    it('returns false for error result', () => {
      expect(isWalletSuccess(errorResult)).toBe(false);
    });
  });

  describe('isWalletError', () => {
    it('returns true for error result', () => {
      expect(isWalletError(errorResult)).toBe(true);
    });

    it('returns false for success result', () => {
      expect(isWalletError(successResult)).toBe(false);
    });
  });

  describe('error codes', () => {
    const errorCodes: WalletErrorCode[] = [
      'INSUFFICIENT_FUNDS',
      'PLAYER_BLOCKED',
      'TOKEN_EXPIRED',
      'DUPLICATE_TRANSACTION',
      'LIMIT_REACHED',
      'TIMEOUT',
      'INVALID_SIGNATURE',
    ];

    it.each(errorCodes)('supports error code: %s', (code) => {
      const result: WalletResult = { success: false, error: code };
      expect(isWalletError(result)).toBe(true);
      if (isWalletError(result)) {
        expect(result.error).toBe(code);
      }
    });
  });

  describe('type narrowing', () => {
    it('narrows to success type', () => {
      if (isWalletSuccess(successWithTxId)) {
        expect(successWithTxId.balance.toCents()).toBe(5000);
        expect(successWithTxId.operatorTxId).toBe('op-tx-123');
      }
    });

    it('narrows to error type', () => {
      if (isWalletError(errorResult)) {
        expect(errorResult.error).toBe('INSUFFICIENT_FUNDS');
      }
    });
  });
});
