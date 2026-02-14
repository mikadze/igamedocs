export type RefreshTokenResult =
  | { success: true; accessToken: string }
  | { success: false; error: 'INVALID_REFRESH_TOKEN' };
