import { BetSnapshot } from '@shared/kernel/BetSnapshot';

export type CashoutResult =
  | { success: true; payoutCents: number; snapshot: BetSnapshot }
  | {
      success: false;
      error:
        | 'BET_NOT_FOUND'
        | 'NOT_BET_OWNER'
        | 'BET_NOT_ACTIVE'
        | 'ROUND_NOT_RUNNING'
        | 'ROUND_MISMATCH';
    };
