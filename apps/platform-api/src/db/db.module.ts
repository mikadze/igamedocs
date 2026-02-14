import { Module, Global, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DbService } from './db.service';
import { Pool } from 'pg';

export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new Pool({
          host: config.get('DATABASE_HOST', 'localhost'),
          port: config.get<number>('DATABASE_PORT', 5432),
          database: config.get('DATABASE_NAME', 'aviatrix'),
          user: config.get('DATABASE_USER', 'aviatrix'),
          password: config.get('DATABASE_PASSWORD', 'aviatrix_dev'),
          max: 25,
          idleTimeoutMillis: 10_000,
          connectionTimeoutMillis: 3_000,
          statement_timeout: 5_000,
        });
      },
    },
    DbService,
  ],
  exports: [PG_POOL, DbService],
})
export class DbModule implements OnModuleDestroy {
  constructor(private readonly dbService: DbService) {}

  async onModuleDestroy() {
    await this.dbService.pool.end();
  }
}
