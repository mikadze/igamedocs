import { BetSnapshot } from '@shared/kernel/BetSnapshot';

export type PlaceBetResult =
  | { success: true; snapshot: BetSnapshot }
  | {
      success: false;
      error:
        | 'BELOW_MIN_BET'
        | 'ABOVE_MAX_BET'
        | 'INSUFFICIENT_FUNDS'
        | 'PLAYER_BLOCKED'
        | 'WALLET_TIMEOUT'
        | 'ROUND_NOT_BETTING';
    };
