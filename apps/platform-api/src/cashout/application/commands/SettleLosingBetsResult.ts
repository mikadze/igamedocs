export type SettleLosingBetsResult =
  | { success: true; settledCount: number }
  | { success: false; error: 'SETTLE_FAILED' };
