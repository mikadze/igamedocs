import {
  Module,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Inject,
} from '@nestjs/common';
import { GameConfigModule } from './config/config.module';
import { MessagingModule } from './messaging/messaging.module';
import { RngModule } from '@rng/infrastructure/rng.module';
import {
  BettingModule,
} from '@betting/infrastructure/betting.module';
import {
  EngineModule,
  RUN_GAME_LOOP_USE_CASE,
} from '@engine/infrastructure/engine.module';
import { RunGameLoopUseCase } from '@engine/application/RunGameLoopUseCase';

@Module({
  imports: [
    GameConfigModule,
    MessagingModule,
    RngModule,
    BettingModule,
    EngineModule,
  ],
})
export class AppModule
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  constructor(
    @Inject(RUN_GAME_LOOP_USE_CASE)
    private readonly gameLoop: RunGameLoopUseCase,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.gameLoop.start();
  }

  async onApplicationShutdown(): Promise<void> {
    this.gameLoop.stop();
    await this.gameLoop.drain();
  }
}
