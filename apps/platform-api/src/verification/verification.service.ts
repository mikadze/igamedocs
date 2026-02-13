import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import Redis from 'ioredis';
import { DbService } from '../db/db.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { seedAuditLogs, rounds } from '../db/schema';

const VERIFICATION_CACHE_TTL = 3600; // 1 hour — immutable after round completes

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly db: DbService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Get verification data for a round.
   * Active rounds: only serverSeedHash (pre-commitment).
   * Completed rounds: full seed reveal.
   */
  async getVerificationData(roundId: string) {
    // Try cache first (only settled rounds are cached)
    const cached = await this.redis.get(`verify:${roundId}`);
    if (cached) return JSON.parse(cached);

    // Get round status + seed data
    const [round] = await this.db.drizzle
      .select()
      .from(rounds)
      .where(eq(rounds.id, roundId))
      .limit(1);

    if (!round) return null;

    const [seedLog] = await this.db.drizzle
      .select()
      .from(seedAuditLogs)
      .where(eq(seedAuditLogs.roundId, roundId))
      .limit(1);

    if (!seedLog) return null;

    const isComplete = round.status === 'CRASHED' || round.status === 'SETTLED';

    const result = isComplete
      ? {
          roundId,
          status: round.status,
          crashPoint: round.crashPoint,
          serverSeed: seedLog.serverSeed,
          serverSeedHash: seedLog.serverSeedHash,
          clientSeed: seedLog.clientSeed,
          combinedHash: seedLog.combinedHash,
          derivedCrashPoint: seedLog.derivedCrashPoint,
          verified: true,
        }
      : {
          roundId,
          status: round.status,
          serverSeedHash: seedLog.serverSeedHash,
          verified: false,
        };

    // Cache completed rounds (immutable data)
    if (isComplete) {
      await this.redis.setex(
        `verify:${roundId}`,
        VERIFICATION_CACHE_TTL,
        JSON.stringify(result),
      );
    }

    return result;
  }
}
