export interface PlaceBetCommand {
  idempotencyKey: string;
  playerId: string;
  roundId: string;
  amountCents: number;
  autoCashout?: number;
}
