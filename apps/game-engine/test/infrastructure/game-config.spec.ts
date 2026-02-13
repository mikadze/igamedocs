import { gameConfigSchema } from '@config/game-config.schema';

const validEnv = {
  HOUSE_EDGE_PERCENT: '4',
  MIN_BET_CENTS: '10',
  MAX_BET_CENTS: '100000',
  BETTING_WINDOW_MS: '10000',
  TICK_INTERVAL_MS: '50',
};

describe('gameConfigSchema', () => {
  it('parses valid env vars and coerces strings to numbers', () => {
    const result = gameConfigSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HOUSE_EDGE_PERCENT).toBe(4);
      expect(result.data.MIN_BET_CENTS).toBe(10);
      expect(result.data.MAX_BET_CENTS).toBe(100000);
      expect(result.data.BETTING_WINDOW_MS).toBe(10000);
      expect(result.data.TICK_INTERVAL_MS).toBe(50);
    }
  });

  it('rejects HOUSE_EDGE_PERCENT > 100', () => {
    const result = gameConfigSchema.safeParse({
      ...validEnv,
      HOUSE_EDGE_PERCENT: '101',
    });
    expect(result.success).toBe(false);
  });

  it('rejects HOUSE_EDGE_PERCENT < 0', () => {
    const result = gameConfigSchema.safeParse({
      ...validEnv,
      HOUSE_EDGE_PERCENT: '-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects MIN_BET_CENTS >= MAX_BET_CENTS', () => {
    const result = gameConfigSchema.safeParse({
      ...validEnv,
      MIN_BET_CENTS: '100000',
      MAX_BET_CENTS: '100',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    const result = gameConfigSchema.safeParse({
      ...validEnv,
      HOUSE_EDGE_PERCENT: 'not-a-number',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = gameConfigSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-integer MIN_BET_CENTS', () => {
    const result = gameConfigSchema.safeParse({
      ...validEnv,
      MIN_BET_CENTS: '10.5',
    });
    expect(result.success).toBe(false);
  });

  it('allows GROWTH_RATE to be omitted', () => {
    const result = gameConfigSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.GROWTH_RATE).toBeUndefined();
    }
  });

  it('parses GROWTH_RATE when provided', () => {
    const result = gameConfigSchema.safeParse({
      ...validEnv,
      GROWTH_RATE: '0.06',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.GROWTH_RATE).toBe(0.06);
    }
  });

  it('rejects negative GROWTH_RATE', () => {
    const result = gameConfigSchema.safeParse({
      ...validEnv,
      GROWTH_RATE: '-0.5',
    });
    expect(result.success).toBe(false);
  });
});
