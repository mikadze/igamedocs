import type { RateLimiter } from '@shared/ports/RateLimiter';

interface WindowEntry {
  count: number;
  expiresAt: number;
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, WindowEntry>();

  constructor(
    private readonly maxPerWindow: number = 5,
    private readonly windowMs: number = 1000,
  ) {}

  allow(playerId: string, action: string): boolean {
    const key = `${playerId}:${action}`;
    const now = Date.now();
    const entry = this.windows.get(key);

    if (!entry || now >= entry.expiresAt) {
      this.windows.set(key, { count: 1, expiresAt: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.maxPerWindow) return false;
    entry.count++;
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.windows) {
      if (now >= entry.expiresAt) {
        this.windows.delete(key);
      }
    }
  }
}
