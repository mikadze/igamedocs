export type PlaceBetResult =
  | { success: true; betId: string }
  | {
      success: false;
      error:
        | 'BELOW_MIN_BET'
        | 'ABOVE_MAX_BET'
        | 'INSUFFICIENT_FUNDS'
        | 'PLAYER_BLOCKED'
        | 'WALLET_TIMEOUT';
    };
