import { RoundRecord } from '../../domain/RoundRecord';

export type GetCurrentRoundResult =
  | { success: true; round: RoundRecord }
  | { success: false; error: 'NO_ACTIVE_ROUND' };
