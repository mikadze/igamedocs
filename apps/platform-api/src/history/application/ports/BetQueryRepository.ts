import { PaginationCursor } from '@shared/types/Cursor';
import { PaginatedResult } from '@shared/types/PaginatedResult';
import { BetSummary } from './RoundQueryRepository';

export interface BetQueryRepository {
  findByPlayerPaginated(
    operatorPlayerId: string,
    cursor: PaginationCursor | undefined,
    limit: number,
  ): Promise<PaginatedResult<BetSummary>>;

  findByRoundId(roundId: string): Promise<BetSummary[]>;
}
