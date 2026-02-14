import { Money } from '@shared/kernel/Money';
import { WalletErrorCode } from '@shared/types/WalletErrorCode';

export type CashoutRollbackBetResult =
  | { success: true; balance: Money }
  | { success: false; error: WalletErrorCode };
