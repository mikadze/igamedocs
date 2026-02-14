export interface BetSnapshot {
  betId: string;
  playerId: string;
  roundId: string;
  amountCents: number;
  status: string;
  cashoutMultiplier?: number;
  payoutCents?: number;
}
