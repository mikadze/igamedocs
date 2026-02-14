import { Money } from '@shared/kernel/Money';
import { WalletErrorCode } from '../../domain/WalletResult';

export type GetBalanceResult =
  | { success: true; balance: Money; currency: string; cached: boolean }
  | { success: false; error: WalletErrorCode };
