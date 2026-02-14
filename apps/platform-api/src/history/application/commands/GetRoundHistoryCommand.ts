import { PaginationCursor } from '@shared/types/Cursor';

export interface GetRoundHistoryCommand {
  operatorId: string;
  cursor?: PaginationCursor;
  limit?: number;
}
