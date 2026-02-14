import { PaginatedResult } from '@shared/types/PaginatedResult';
import { RoundSummary } from '../ports/RoundQueryRepository';

export type GetRoundHistoryResult = PaginatedResult<RoundSummary>;
