export interface CashoutRollbackBetCommand {
  operatorId: string;
  operatorToken: string;
  playerId: string;
  roundId: string;
  betTransactionUuid: string;
  currency: string;
}
