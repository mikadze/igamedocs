export interface PlaceBetRequest {
  playerId: string;
  roundId: string;
  amountCents: number;
  autoCashout?: number;
}

export interface CashoutRequest {
  playerId: string;
  roundId: string;
  betId: string;
}

export interface EventSubscriber {
  onPlaceBet(handler: (cmd: PlaceBetRequest) => void): void;
  onCashout(handler: (cmd: CashoutRequest) => void): void;
}
