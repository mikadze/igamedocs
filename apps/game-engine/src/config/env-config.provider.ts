import { Provider } from '@nestjs/common';
import { GameConfig } from '@shared/kernel/GameConfig';
import { GameTopics } from '@messaging/topics';
import { createTopics } from '@messaging/topics';
import { gameConfigSchema, RawGameConfig } from './game-config.schema';

export const VALIDATED_ENV = 'VALIDATED_ENV';
export const GAME_CONFIG = 'GAME_CONFIG';

/**
 * Runs Zod validation once at boot. All other providers
 * derive their values from this single source of truth.
 */
export const validatedEnvProvider: Provider<RawGameConfig> = {
  provide: VALIDATED_ENV,
  useFactory: (): RawGameConfig => {
    const result = gameConfigSchema.safeParse({
      OPERATOR_ID: process.env.OPERATOR_ID,
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
      throw new Error(`[GameConfig] Invalid environment variables:\n${messages}`);
    }

    return result.data;
  },
};

/**
 * Domain config — no operatorId, no infrastructure concerns.
 */
export const gameConfigProvider: Provider<GameConfig> = {
  provide: GAME_CONFIG,
  useFactory: (env: RawGameConfig): GameConfig => ({
    houseEdgePercent: env.HOUSE_EDGE_PERCENT,
    minBetCents: env.MIN_BET_CENTS,
    maxBetCents: env.MAX_BET_CENTS,
    bettingWindowMs: env.BETTING_WINDOW_MS,
    tickIntervalMs: env.TICK_INTERVAL_MS,
    growthRate: env.GROWTH_RATE,
  }),
  inject: [VALIDATED_ENV],
};

/**
 * Infrastructure-only: operator-scoped NATS topic constants.
 * Domain and application layers never see this.
 */
export const natsTopicsProvider: Provider<GameTopics> = {
  provide: 'NATS_TOPICS',
  useFactory: (env: RawGameConfig): GameTopics => createTopics(env.OPERATOR_ID),
  inject: [VALIDATED_ENV],
};
