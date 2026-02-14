import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryRateLimiter } from '@messaging/infrastructure/InMemoryRateLimiter';

describe('InMemoryRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to the window limit', () => {
    const limiter = new InMemoryRateLimiter(3, 1000);

    expect(limiter.allow('p1', 'place_bet')).toBe(true);
    expect(limiter.allow('p1', 'place_bet')).toBe(true);
    expect(limiter.allow('p1', 'place_bet')).toBe(true);
    expect(limiter.allow('p1', 'place_bet')).toBe(false);
  });

  it('resets after window expires', () => {
    const limiter = new InMemoryRateLimiter(2, 1000);

    expect(limiter.allow('p1', 'place_bet')).toBe(true);
    expect(limiter.allow('p1', 'place_bet')).toBe(true);
    expect(limiter.allow('p1', 'place_bet')).toBe(false);

    vi.advanceTimersByTime(1000);

    expect(limiter.allow('p1', 'place_bet')).toBe(true);
    expect(limiter.allow('p1', 'place_bet')).toBe(true);
    expect(limiter.allow('p1', 'place_bet')).toBe(false);
  });

  it('isolates rate limits per player', () => {
    const limiter = new InMemoryRateLimiter(1, 1000);

    expect(limiter.allow('p1', 'place_bet')).toBe(true);
    expect(limiter.allow('p1', 'place_bet')).toBe(false);

    expect(limiter.allow('p2', 'place_bet')).toBe(true);
    expect(limiter.allow('p2', 'place_bet')).toBe(false);
  });

  it('isolates rate limits per action', () => {
    const limiter = new InMemoryRateLimiter(1, 1000);

    expect(limiter.allow('p1', 'place_bet')).toBe(true);
    expect(limiter.allow('p1', 'place_bet')).toBe(false);

    expect(limiter.allow('p1', 'cashout')).toBe(true);
    expect(limiter.allow('p1', 'cashout')).toBe(false);
  });

  it('cleans up expired entries', () => {
    const limiter = new InMemoryRateLimiter(1, 100);

    limiter.allow('p1', 'place_bet');
    limiter.allow('p2', 'place_bet');

    vi.advanceTimersByTime(200);

    limiter.cleanup();

    // After cleanup, new windows should be created
    expect(limiter.allow('p1', 'place_bet')).toBe(true);
    expect(limiter.allow('p2', 'place_bet')).toBe(true);
  });

  it('uses default values when not specified', () => {
    const limiter = new InMemoryRateLimiter();

    // Default: 5 per 1000ms
    for (let i = 0; i < 5; i++) {
      expect(limiter.allow('p1', 'action')).toBe(true);
    }
    expect(limiter.allow('p1', 'action')).toBe(false);
  });
});
