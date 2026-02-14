import { Money } from '@shared/kernel/Money';
import { WalletErrorCode } from '@shared/types/WalletErrorCode';

export interface RollbackBetCommand {
  operatorId: string;
  operatorToken: string;
  playerId: string;
  roundId: string;
  referenceTransactionUuid: string;
  currency: string;
}

export type RollbackBetResult =
  | { success: true; transactionUuid: string; balance: Money }
  | { success: false; error: WalletErrorCode };

export interface RollbackBetPort {
  execute(command: RollbackBetCommand): Promise<RollbackBetResult>;
}
