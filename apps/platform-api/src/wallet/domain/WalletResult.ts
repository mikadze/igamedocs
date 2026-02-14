import { Money } from '@shared/kernel/Money';

export type { WalletErrorCode } from '@shared/types/WalletErrorCode';
import type { WalletErrorCode } from '@shared/types/WalletErrorCode';

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
