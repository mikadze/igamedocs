import { Money } from '@shared/kernel/Money';

export interface ProcessCashoutCommand {
  operatorId: string;
  operatorToken: string;
  playerId: string;
  roundId: string;
  betId: string;
  betAmount: Money;
  cashoutMultiplier: number;
  currency: string;
  betTransactionUuid: string;
}
