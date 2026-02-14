export interface RoundSummary {
  id: string;
  operatorId: string;
  status: string;
  crashPoint: string | null;
  bettingWindowMs: number;
  startedAt: Date | null;
  crashedAt: Date | null;
  settledAt: Date | null;
  createdAt: Date;
}
