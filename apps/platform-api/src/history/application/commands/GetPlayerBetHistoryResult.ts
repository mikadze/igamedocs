import { PaginatedResult } from '@shared/types/PaginatedResult';
import { BetSummary } from '../ports/RoundQueryRepository';

export type GetPlayerBetHistoryResult = PaginatedResult<BetSummary>;
