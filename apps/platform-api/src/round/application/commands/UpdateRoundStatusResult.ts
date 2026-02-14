import { RoundRecord } from '../../domain/RoundRecord';

export type UpdateRoundStatusResult =
  | { success: true; round: RoundRecord }
  | { success: false; error: 'ROUND_NOT_FOUND' | 'INVALID_TRANSITION' | 'INVALID_CRASH_POINT' };
