import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Round, Bet, SeedAuditLog } from './entities';

const entities = [Round, Bet, SeedAuditLog];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5432),
        username: config.get('DATABASE_USER', 'aviatrix'),
        password: config.get('DATABASE_PASSWORD', 'aviatrix_dev'),
        database: config.get('DATABASE_NAME', 'aviatrix'),
        schema: 'game',
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') !== 'production',
      }),
    }),
    TypeOrmModule.forFeature(entities),
  ],
  exports: [TypeOrmModule.forFeature(entities)],
})
export class DatabaseModule {}
