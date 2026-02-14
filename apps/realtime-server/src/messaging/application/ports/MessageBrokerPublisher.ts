export interface MessageBrokerPublisher {
  publishPlaceBet(payload: {
    idempotencyKey: string;
    playerId: string;
    roundId: string;
    amountCents: number;
    autoCashout?: number;
  }): void;

  publishCashout(payload: {
    playerId: string;
    roundId: string;
    betId: string;
  }): void;
}
