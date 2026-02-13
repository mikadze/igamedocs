import { Provider } from '@nestjs/common';
import { GameConfig } from '@shared/kernel/GameConfig';
import { gameConfigSchema } from './game-config.schema';

export const GAME_CONFIG = 'GAME_CONFIG';

export const gameConfigProvider: Provider<GameConfig> = {
  provide: GAME_CONFIG,
  useFactory: (): GameConfig => {
    const result = gameConfigSchema.safeParse({
      HOUSE_EDGE_PERCENT: process.env.HOUSE_EDGE_PERCENT,
      MIN_BET_CENTS: process.env.MIN_BET_CENTS,
      MAX_BET_CENTS: process.env.MAX_BET_CENTS,
      BETTING_WINDOW_MS: process.env.BETTING_WINDOW_MS,
      TICK_INTERVAL_MS: process.env.TICK_INTERVAL_MS,
      GROWTH_RATE: process.env.GROWTH_RATE,
    });

    if (!result.success) {
      const messages = result.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
      throw new Error(
        `[GameConfig] Invalid environment variables:\n${messages}`,
      );
    }

    const env = result.data;

    return {
      houseEdgePercent: env.HOUSE_EDGE_PERCENT,
      minBetCents: env.MIN_BET_CENTS,
      maxBetCents: env.MAX_BET_CENTS,
      bettingWindowMs: env.BETTING_WINDOW_MS,
      tickIntervalMs: env.TICK_INTERVAL_MS,
      growthRate: env.GROWTH_RATE,
    };
  },
};
