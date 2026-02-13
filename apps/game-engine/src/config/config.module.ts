import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { gameConfigProvider, GAME_CONFIG } from './env-config.provider';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  providers: [gameConfigProvider],
  exports: [GAME_CONFIG],
})
export class GameConfigModule {}
