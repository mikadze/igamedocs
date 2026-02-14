import { Money } from '@shared/kernel/Money';

export type WalletErrorCode =
  | 'INSUFFICIENT_FUNDS'
  | 'PLAYER_BLOCKED'
  | 'TOKEN_EXPIRED'
  | 'DUPLICATE_TRANSACTION'
  | 'LIMIT_REACHED'
  | 'TIMEOUT'
  | 'INVALID_SIGNATURE';

export type WalletResult =
  | { success: true; balance: Money; operatorTxId?: string }
  | { success: false; error: WalletErrorCode };

export function isWalletSuccess(
  result: WalletResult,
): result is { success: true; balance: Money; operatorTxId?: string } {
  return result.success === true;
}

export function isWalletError(
  result: WalletResult,
): result is { success: false; error: WalletErrorCode } {
  return result.success === false;
}
