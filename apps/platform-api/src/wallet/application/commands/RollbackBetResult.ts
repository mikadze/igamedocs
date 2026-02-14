import { Money } from '@shared/kernel/Money';
import { WalletErrorCode } from '../../domain/WalletResult';

export type RollbackBetResult =
  | { success: true; transactionUuid: string; balance: Money }
  | { success: false; error: WalletErrorCode };
