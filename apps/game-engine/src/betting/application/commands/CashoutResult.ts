export type CashoutResult =
  | { success: true; payoutCents: number }
  | {
      success: false;
      error:
        | 'BET_NOT_FOUND'
        | 'NOT_BET_OWNER'
        | 'BET_NOT_ACTIVE'
        | 'ROUND_NOT_RUNNING'
        | 'WALLET_TIMEOUT';
    };
