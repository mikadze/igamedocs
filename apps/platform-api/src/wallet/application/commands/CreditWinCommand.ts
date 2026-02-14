import { Money } from '@shared/kernel/Money';

export interface CreditWinCommand {
  operatorId: string;
  operatorToken: string;
  playerId: string;
  roundId: string;
  amount: Money;
  currency: string;
  referenceTransactionUuid: string;
}
