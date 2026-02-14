import { Money } from '@shared/kernel/Money';

export interface PlaceBetCommand {
  operatorId: string;
  operatorToken: string;
  playerId: string;
  roundId: string;
  amount: Money;
  currency: string;
}
