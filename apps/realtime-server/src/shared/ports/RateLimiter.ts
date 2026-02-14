export interface RateLimiter {
  allow(playerId: string, action: string): boolean;
}
