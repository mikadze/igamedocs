import { Money } from '@shared/kernel/Money';
import { WalletErrorCode } from '../../domain/WalletResult';

export type CreditWinResult =
  | { success: true; transactionUuid: string; balance: Money }
  | { success: false; error: WalletErrorCode };
