import { Injectable, Inject } from '@nestjs/common';
import { eq, and, lt, or, desc } from 'drizzle-orm';
import Redis from 'ioredis';
import { DbService } from '../db/db.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { rounds, bets, seedAuditLogs } from '../db/schema';

const HISTORY_PAGE_SIZE = 20;
const RECENT_ROUNDS_CACHE_TTL = 60; // 1 minute

@Injectable()
export class HistoryService {
  constructor(
    private readonly db: DbService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Paginated round history (cursor-based).
   * Page 1 served from Redis cache, deeper pages from DB.
   */
  async getRoundHistory(
    operatorId: string,
    cursor?: { ts: string; id: string },
    limit = HISTORY_PAGE_SIZE,
  ) {
    // Page 1 — try Redis cache
    if (!cursor) {
      const cached = await this.redis.get(`history:rounds:${operatorId}`);
      if (cached) return JSON.parse(cached);
    }

    let query = this.db.drizzle
      .select()
      .from(rounds)
      .where(
        cursor
          ? and(
              eq(rounds.operatorId, operatorId),
              or(
                lt(rounds.createdAt, new Date(cursor.ts)),
                and(
                  eq(rounds.createdAt, new Date(cursor.ts)),
                  lt(rounds.id, cursor.id),
                ),
              ),
            )
          : eq(rounds.operatorId, operatorId),
      )
      .orderBy(desc(rounds.createdAt), desc(rounds.id))
      .limit(limit + 1); // fetch one extra to detect next page

    const rows = await query;
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    const result = {
      data,
      hasMore,
      nextCursor: hasMore
        ? { ts: data[data.length - 1].createdAt.toISOString(), id: data[data.length - 1].id }
        : null,
    };

    // Cache page 1
    if (!cursor) {
      await this.redis.setex(
        `history:rounds:${operatorId}`,
        RECENT_ROUNDS_CACHE_TTL,
        JSON.stringify(result),
      );
    }

    return result;
  }

  /**
   * Player's bet history (cursor-based).
   */
  async getPlayerBetHistory(
    operatorPlayerId: string,
    cursor?: { ts: string; id: string },
    limit = HISTORY_PAGE_SIZE,
  ) {
    const rows = await this.db.drizzle
      .select()
      .from(bets)
      .where(
        cursor
          ? and(
              eq(bets.operatorPlayerId, operatorPlayerId),
              or(
                lt(bets.createdAt, new Date(cursor.ts)),
                and(
                  eq(bets.createdAt, new Date(cursor.ts)),
                  lt(bets.id, cursor.id),
                ),
              ),
            )
          : eq(bets.operatorPlayerId, operatorPlayerId),
      )
      .orderBy(desc(bets.createdAt), desc(bets.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    return {
      data,
      hasMore,
      nextCursor: hasMore
        ? { ts: data[data.length - 1].createdAt.toISOString(), id: data[data.length - 1].id }
        : null,
    };
  }

  /**
   * Full round audit data — for aggregator /game/round endpoint.
   * Returns all bets, seeds, crash point, timestamps.
   */
  async getRoundAuditData(roundId: string) {
    const [round] = await this.db.drizzle
      .select()
      .from(rounds)
      .where(eq(rounds.id, roundId))
      .limit(1);

    if (!round) return null;

    const [roundBets, seedData] = await Promise.all([
      this.db.drizzle
        .select()
        .from(bets)
        .where(eq(bets.roundId, roundId)),
      this.db.drizzle
        .select()
        .from(seedAuditLogs)
        .where(eq(seedAuditLogs.roundId, roundId))
        .limit(1),
    ]);

    return {
      round,
      bets: roundBets,
      seeds: seedData[0] ?? null,
    };
  }
}
