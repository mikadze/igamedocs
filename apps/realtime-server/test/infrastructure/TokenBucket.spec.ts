import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenBucket } from '@transport/TokenBucket';

describe('TokenBucket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to capacity in burst', () => {
    const bucket = new TokenBucket(5, 1);

    for (let i = 0; i < 5; i++) {
      expect(bucket.consume()).toBe(true);
    }
    expect(bucket.consume()).toBe(false);
  });

  it('refills over time at the configured rate', () => {
    const bucket = new TokenBucket(5, 10);

    // Consume all tokens
    for (let i = 0; i < 5; i++) {
      bucket.consume();
    }
    expect(bucket.consume()).toBe(false);

    // Advance 500ms: should refill 5 tokens (10/sec * 0.5s)
    vi.advanceTimersByTime(500);
    for (let i = 0; i < 5; i++) {
      expect(bucket.consume()).toBe(true);
    }
    expect(bucket.consume()).toBe(false);
  });

  it('does not exceed capacity on refill', () => {
    const bucket = new TokenBucket(3, 10);

    // Advance a lot of time without consuming
    vi.advanceTimersByTime(10000);

    // Should only have capacity worth of tokens
    for (let i = 0; i < 3; i++) {
      expect(bucket.consume()).toBe(true);
    }
    expect(bucket.consume()).toBe(false);
  });

  it('handles zero elapsed time correctly', () => {
    const bucket = new TokenBucket(2, 10);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);
  });
});
