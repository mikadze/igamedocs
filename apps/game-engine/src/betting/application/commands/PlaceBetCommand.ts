export interface PlaceBetCommand {
  playerId: string;
  roundId: string;
  amountCents: number;
  autoCashout?: number;
}
