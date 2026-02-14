import { RoundAuditData } from '../ports/RoundQueryRepository';

export type GetRoundAuditDataResult =
  | { success: true; data: RoundAuditData }
  | { success: false; error: 'ROUND_NOT_FOUND' };
