import { PaginationCursor } from '@shared/types/Cursor';

export interface GetPlayerBetHistoryCommand {
  operatorPlayerId: string;
  cursor?: PaginationCursor;
  limit?: number;
}
