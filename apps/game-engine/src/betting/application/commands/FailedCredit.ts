export interface FailedCredit {
  id: string;
  playerId: string;
  roundId: string;
  betId: string;
  payoutCents: number;
  reason: string;
  occurredAt: number;
  retryCount: number;
  resolved: boolean;
}
