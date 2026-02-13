import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import Redis from 'ioredis';
import { DbService } from '../db/db.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { rounds } from '../db/schema';

const CURRENT_ROUND_TTL = 0; // no TTL — explicitly updated on state change
const SETTLED_ROUND_TTL = 300; // 5 minutes

@Injectable()
export class RoundService {
  private readonly logger = new Logger(RoundService.name);

  constructor(
    private readonly db: DbService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Create a new round for an operator.
   */
  async createRound(operatorId: string, bettingWindowMs = 10000) {
    const [round] = await this.db.drizzle
      .insert(rounds)
      .values({ operatorId, bettingWindowMs })
      .returning();

    // Set as current round in Redis (no TTL — explicitly replaced)
    await this.redis.set(
      `round:current:${operatorId}`,
      JSON.stringify(round),
    );

    this.logger.log(`Round ${round.id} created for operator ${operatorId}`);
    return round;
  }

  /**
   * Transition round status.
   */
  async updateStatus(
    roundId: string,
    status: 'WAITING' | 'BETTING' | 'FLYING' | 'CRASHED' | 'SETTLED',
  ) {
    const timestamps: Record<string, Date> = {};
    if (status === 'FLYING') timestamps.startedAt = new Date();
    if (status === 'CRASHED') timestamps.crashedAt = new Date();
    if (status === 'SETTLED') timestamps.settledAt = new Date();

    const [updated] = await this.db.drizzle
      .update(rounds)
      .set({ status, ...timestamps })
      .where(eq(rounds.id, roundId))
      .returning();

    if (!updated) return null;

    // Update Redis cache
    if (status === 'SETTLED' || status === 'CRASHED') {
      // Cache settled round with TTL
      await this.redis.setex(
        `round:${roundId}`,
        SETTLED_ROUND_TTL,
        JSON.stringify(updated),
      );
    }

    // Update current round cache for the operator
    const currentKey = `round:current:${updated.operatorId}`;
    if (status === 'SETTLED') {
      // Clear current round — next round will be created by game engine
      await this.redis.del(currentKey);
    } else {
      await this.redis.set(currentKey, JSON.stringify(updated));
    }

    return updated;
  }

  /**
   * Record crash point when round crashes (hot path — raw pg).
   */
  async recordCrashPoint(roundId: string, crashPoint: string) {
    await this.db.recordCrashPointRaw(roundId, crashPoint);
  }

  /**
   * Get current active round for an operator (Redis-first).
   */
  async getCurrentRound(operatorId: string) {
    const cached = await this.redis.get(`round:current:${operatorId}`);
    if (cached) return JSON.parse(cached);

    // Fallback to DB — find latest non-settled round
    const [round] = await this.db.drizzle
      .select()
      .from(rounds)
      .where(eq(rounds.operatorId, operatorId))
      .orderBy(desc(rounds.createdAt))
      .limit(1);

    if (round && round.status !== 'SETTLED') {
      await this.redis.set(
        `round:current:${operatorId}`,
        JSON.stringify(round),
      );
      return round;
    }

    return null;
  }

  /**
   * Get round by ID (Redis cache for settled rounds, DB fallback).
   */
  async getRoundById(roundId: string) {
    // Try Redis cache first (settled rounds are cached)
    const cached = await this.redis.get(`round:${roundId}`);
    if (cached) return JSON.parse(cached);

    const [round] = await this.db.drizzle
      .select()
      .from(rounds)
      .where(eq(rounds.id, roundId))
      .limit(1);

    if (round && (round.status === 'SETTLED' || round.status === 'CRASHED')) {
      await this.redis.setex(
        `round:${roundId}`,
        SETTLED_ROUND_TTL,
        JSON.stringify(round),
      );
    }

    return round ?? null;
  }
}
