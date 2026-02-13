import { Injectable, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import { Cache } from 'cache-manager';

@Injectable()
export class AppService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getHealth() {
    const services: Record<string, string> = {};

    // Check PostgreSQL
    try {
      await this.dataSource.query('SELECT 1');
      services.database = 'connected';
    } catch {
      services.database = 'disconnected';
    }

    // Check Redis
    try {
      const store = (this.cacheManager as any).store;
      if (store?.client) {
        const pong = await store.client.ping();
        services.redis = pong === 'PONG' ? 'connected' : 'disconnected';
      } else {
        await this.cacheManager.set('health-check', 'ok', 5000);
        const val = await this.cacheManager.get('health-check');
        services.redis = val === 'ok' ? 'connected' : 'disconnected';
      }
    } catch {
      services.redis = 'disconnected';
    }

    const allConnected = Object.values(services).every((s) => s === 'connected');

    return {
      status: allConnected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
    };
  }
}
