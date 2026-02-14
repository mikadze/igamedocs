import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { DbService } from './db/db.service';
import { REDIS_CLIENT } from './redis/redis.module';

@Injectable()
export class AppService {
  constructor(
    private readonly db: DbService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getHealth() {
    const services: Record<string, string> = {};

    // Check PostgreSQL via raw pool
    try {
      await this.db.pool.query('SELECT 1');
      services.database = 'connected';
    } catch {
      services.database = 'disconnected';
    }

    // Check Redis via direct ioredis
    try {
      const pong = await this.redis.ping();
      services.redis = pong === 'PONG' ? 'connected' : 'disconnected';
    } catch {
      services.redis = 'disconnected';
    }

    const allConnected = Object.values(services).every(
      (s) => s === 'connected',
    );

    return {
      status: allConnected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
    };
  }
}
