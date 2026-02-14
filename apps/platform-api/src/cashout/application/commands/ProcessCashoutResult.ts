import { Money } from '@shared/kernel/Money';
import { WalletErrorCode } from '@shared/types/WalletErrorCode';

export type ProcessCashoutResult =
  | { success: true; payout: Money; balance: Money }
  | { success: false; error: 'INVALID_MULTIPLIER' | WalletErrorCode };
