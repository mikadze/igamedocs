export interface MessageBrokerPublisher {
  publishPlaceBet(payload: {
    idempotencyKey: string;
    playerId: string;
    roundId: string;
    amountCents: number;
    autoCashout?: number;
  }): boolean;

  publishCashout(payload: {
    playerId: string;
    roundId: string;
    betId: string;
  }): boolean;
}
