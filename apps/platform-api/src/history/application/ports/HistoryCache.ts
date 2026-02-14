import { PaginatedResult } from '@shared/types/PaginatedResult';
import { RoundSummary } from './RoundQueryRepository';

export interface HistoryCache {
  getRoundHistoryPage1(
    operatorId: string,
  ): Promise<PaginatedResult<RoundSummary> | null>;

  setRoundHistoryPage1(
    operatorId: string,
    result: PaginatedResult<RoundSummary>,
    ttlSeconds: number,
  ): Promise<void>;
}
