import { PaginationCursor } from '@shared/types/Cursor';
import { PaginatedResult } from '@shared/types/PaginatedResult';
import { RoundSummary } from '@shared/types/RoundSummary';
import { SeedData } from '@shared/types/SeedData';

export type { RoundSummary } from '@shared/types/RoundSummary';
export type { SeedData } from '@shared/types/SeedData';

export interface BetSummary {
  id: string;
  roundId: string;
  operatorPlayerId: string;
  amount: string;
  autoCashoutAt: string | null;
  cashoutMultiplier: string | null;
  payout: string | null;
  status: string;
  createdAt: Date;
}

export interface RoundAuditData {
  round: RoundSummary;
  bets: BetSummary[];
  seeds: SeedData | null;
}

export interface RoundQueryRepository {
  findPaginated(
    operatorId: string,
    cursor: PaginationCursor | undefined,
    limit: number,
  ): Promise<PaginatedResult<RoundSummary>>;

  findById(roundId: string): Promise<RoundSummary | null>;

  findAuditData(roundId: string): Promise<RoundAuditData | null>;
}
