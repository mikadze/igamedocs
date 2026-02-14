import { RawGameConfig } from '@config/game-config.schema';
import { GameConfig } from '@shared/kernel/GameConfig';
import { createTopics } from '@messaging/topics';

export const TEST_RAW_CONFIG: RawGameConfig = {
  OPERATOR_ID: 'test-op',
  HOUSE_EDGE_PERCENT: 4,
  MIN_BET_CENTS: 100,
  MAX_BET_CENTS: 1_000_000,
  BETTING_WINDOW_MS: 50,
  TICK_INTERVAL_MS: 10,
  GROWTH_RATE: 0.001,
};

export function toGameConfig(raw: RawGameConfig): GameConfig {
  return {
    houseEdgePercent: raw.HOUSE_EDGE_PERCENT,
    minBetCents: raw.MIN_BET_CENTS,
    maxBetCents: raw.MAX_BET_CENTS,
    bettingWindowMs: raw.BETTING_WINDOW_MS,
    tickIntervalMs: raw.TICK_INTERVAL_MS,
    growthRate: raw.GROWTH_RATE,
  };
}

export const TEST_GAME_CONFIG = toGameConfig(TEST_RAW_CONFIG);

export const TEST_TOPICS = createTopics(TEST_RAW_CONFIG.OPERATOR_ID);

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function flushPromises(): Promise<void> {
  return new Promise((resolve) => process.nextTick(resolve));
}
