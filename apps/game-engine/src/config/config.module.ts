import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  validatedEnvProvider,
  gameConfigProvider,
  natsTopicsProvider,
  GAME_CONFIG,
} from './env-config.provider';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  providers: [validatedEnvProvider, gameConfigProvider, natsTopicsProvider],
  exports: ['VALIDATED_ENV', GAME_CONFIG, 'NATS_TOPICS'],
})
export class GameConfigModule {}
