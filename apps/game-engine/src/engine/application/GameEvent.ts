import { BetSnapshot } from '@shared/kernel/BetSnapshot';

export type GameEvent =
  | { readonly type: 'bet_won'; readonly snapshot: BetSnapshot }
  | { readonly type: 'bet_lost'; readonly snapshot: BetSnapshot; readonly multiplier: number }
  | { readonly type: 'tick'; readonly roundId: string; readonly multiplier: number; readonly elapsedMs: number }
  | { readonly type: 'round_crashed'; readonly roundId: string; readonly multiplier: number; readonly serverSeed: string };
