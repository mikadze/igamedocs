import { Money } from '@shared/kernel/Money';
import { WalletErrorCode } from '@shared/types/WalletErrorCode';

export interface CreditWinCommand {
  operatorId: string;
  operatorToken: string;
  playerId: string;
  roundId: string;
  amount: Money;
  currency: string;
  referenceTransactionUuid: string;
}

export type CreditWinResult =
  | { success: true; transactionUuid: string; balance: Money }
  | { success: false; error: WalletErrorCode };

export interface CreditWinPort {
  execute(command: CreditWinCommand): Promise<CreditWinResult>;
}
