export interface RollbackBetCommand {
  operatorId: string;
  operatorToken: string;
  playerId: string;
  roundId: string;
  referenceTransactionUuid: string;
  currency: string;
}
