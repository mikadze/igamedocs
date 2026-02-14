export type ExchangeTokenResult =
  | { success: true; accessToken: string; refreshToken: string }
  | { success: false; error: 'SESSION_NOT_FOUND' | 'SESSION_EXPIRED' };
