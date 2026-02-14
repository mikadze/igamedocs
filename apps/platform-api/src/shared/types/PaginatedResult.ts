import { PaginationCursor } from './Cursor';

export interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
  nextCursor: PaginationCursor | null;
}
