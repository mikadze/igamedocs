import { RoundRecord } from '../../domain/RoundRecord';

export type CreateRoundResult =
  | { success: true; round: RoundRecord }
  | { success: false; error: 'CREATE_FAILED' };
