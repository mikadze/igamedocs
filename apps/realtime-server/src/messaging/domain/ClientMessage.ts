export type ClientMessage =
  | {
      readonly type: 'place_bet';
      readonly idempotencyKey: string;
      readonly roundId: string;
      readonly amountCents: number;
      readonly autoCashout?: number;
    }
  | {
      readonly type: 'cashout';
      readonly roundId: string;
      readonly betId: string;
    }
  | { readonly type: 'ping' }
  | {
      readonly type: 're_auth';
      readonly token: string;
    };
