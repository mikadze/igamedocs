export type ServerMessage =
  | { readonly type: 'round_new'; readonly roundId: string; readonly hashedSeed: string }
  | { readonly type: 'round_betting'; readonly roundId: string; readonly endsAt: number }
  | { readonly type: 'round_started'; readonly roundId: string }
  | { readonly type: 'round_crashed'; readonly roundId: string; readonly crashPoint: number; readonly serverSeed: string }
  | { readonly type: 'tick'; readonly roundId: string; readonly multiplier: number; readonly elapsedMs: number }
  | { readonly type: 'bet_placed'; readonly betId: string; readonly playerId: string; readonly roundId: string; readonly amountCents: number }
  | { readonly type: 'bet_won'; readonly betId: string; readonly playerId: string; readonly roundId: string; readonly amountCents: number; readonly cashoutMultiplier: number; readonly payoutCents: number }
  | { readonly type: 'bet_lost'; readonly betId: string; readonly playerId: string; readonly roundId: string; readonly amountCents: number; readonly crashPoint: number }
  | { readonly type: 'bet_rejected'; readonly playerId: string; readonly roundId: string; readonly amountCents: number; readonly error: string }
  | { readonly type: 'pong' }
  | { readonly type: 'error'; readonly code: string; readonly message: string }
  | { readonly type: 're_auth_required'; readonly deadlineMs: number }
  | { readonly type: 'credit_failed'; readonly playerId: string; readonly betId: string; readonly roundId: string; readonly payoutCents: number; readonly reason: string };
