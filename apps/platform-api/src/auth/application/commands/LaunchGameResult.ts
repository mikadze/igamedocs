export type LaunchGameResult =
  | { success: true; url: string; token: string }
  | { success: false; error: 'INVALID_LAUNCH_REQUEST' | 'PLAYER_UPSERT_FAILED' };
