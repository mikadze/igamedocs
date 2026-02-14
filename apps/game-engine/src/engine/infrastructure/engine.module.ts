import { Module } from '@nestjs/common';
import { GameConfigModule } from '@config/config.module';
import { GAME_CONFIG, VALIDATED_ENV } from '@config/env-config.provider';
import { RawGameConfig } from '@config/game-config.schema';
import { MessagingModule } from '@messaging/messaging.module';
import { LOGGER, EVENT_PUBLISHER, EVENT_SUBSCRIBER } from '@messaging/tokens';
import {
  BettingModule,
  PLACE_BET_USE_CASE,
  CASHOUT_USE_CASE,
  BET_STORE,
} from '@betting/infrastructure/betting.module';
import { RngModule, SERVER_SEED_PROVIDER } from '@rng/infrastructure/rng.module';
import { GameConfig } from '@shared/kernel/GameConfig';
import { Logger } from '@shared/ports/Logger';
import { EventPublisher } from '@engine/application/ports/EventPublisher';
import { EventSubscriber } from '@engine/application/ports/EventSubscriber';
import { TickScheduler } from '@engine/application/ports/TickScheduler';
import { Timer } from '@engine/application/ports/Timer';
import { CurrentRoundStore } from '@engine/application/ports/CurrentRoundStore';
import { ClientSeedProvider } from '@engine/application/ports/ClientSeedProvider';
import { FailedEventStore } from '@engine/application/ports/FailedEventStore';
import { BetStore } from '@betting/application/ports/BetStore';
import { PlaceBetUseCase } from '@betting/application/PlaceBetUseCase';
import { CashoutUseCase } from '@betting/application/CashoutUseCase';
import { ServerSeedProvider } from '@engine/application/ports/ServerSeedProvider';
import { RunGameLoopUseCase } from '@engine/application/RunGameLoopUseCase';
import { GetRoundStateUseCase } from '@engine/application/GetRoundStateUseCase';
import { InMemoryCurrentRoundStore } from '@engine/infrastructure/InMemoryCurrentRoundStore';
import { InMemoryFailedEventStore } from '@engine/infrastructure/InMemoryFailedEventStore';
import { SetIntervalTickScheduler } from '@engine/infrastructure/SetIntervalTickScheduler';
import { SetTimeoutTimer } from '@engine/infrastructure/SetTimeoutTimer';
import { RandomClientSeedProvider } from '@engine/infrastructure/RandomClientSeedProvider';

export const CURRENT_ROUND_STORE = 'CurrentRoundStore';
export const FAILED_EVENT_STORE = 'FailedEventStore';
export const TICK_SCHEDULER = 'TickScheduler';
export const TIMER = 'Timer';
export const CLIENT_SEED_PROVIDER = 'ClientSeedProvider';
export const RUN_GAME_LOOP_USE_CASE = 'RunGameLoopUseCase';
export const GET_ROUND_STATE_USE_CASE = 'GetRoundStateUseCase';

@Module({
  imports: [GameConfigModule, MessagingModule, BettingModule, RngModule],
  providers: [
    // ── Port → Implementation mappings ──────────────────
    {
      provide: CURRENT_ROUND_STORE,
      useFactory: (): CurrentRoundStore => new InMemoryCurrentRoundStore(),
    },
    {
      provide: FAILED_EVENT_STORE,
      useFactory: (): FailedEventStore => new InMemoryFailedEventStore(),
    },
    {
      provide: TICK_SCHEDULER,
      useFactory: (config: GameConfig): TickScheduler =>
        new SetIntervalTickScheduler(config.tickIntervalMs),
      inject: [GAME_CONFIG],
    },
    {
      provide: TIMER,
      useFactory: (): Timer => new SetTimeoutTimer(),
    },
    {
      provide: CLIENT_SEED_PROVIDER,
      useFactory: (): ClientSeedProvider => new RandomClientSeedProvider(),
    },

    // ── Use cases ───────────────────────────────────────
    {
      provide: RUN_GAME_LOOP_USE_CASE,
      useFactory: (
        config: GameConfig,
        env: RawGameConfig,
        serverSeedProvider: ServerSeedProvider,
        eventPublisher: EventPublisher,
        eventSubscriber: EventSubscriber,
        tickScheduler: TickScheduler,
        timer: Timer,
        placeBetUseCase: PlaceBetUseCase,
        cashoutUseCase: CashoutUseCase,
        currentRoundStore: CurrentRoundStore,
        clientSeedProvider: ClientSeedProvider,
        logger: Logger,
        failedEventStore: FailedEventStore,
        betStore: BetStore,
      ): RunGameLoopUseCase =>
        new RunGameLoopUseCase(
          config,
          serverSeedProvider,
          eventPublisher,
          eventSubscriber,
          tickScheduler,
          timer,
          placeBetUseCase,
          cashoutUseCase,
          currentRoundStore,
          clientSeedProvider,
          logger,
          failedEventStore,
          betStore,
          undefined,
          env.MAX_PLACE_BET_QUEUE,
          env.MAX_CASHOUT_QUEUE,
        ),
      inject: [
        GAME_CONFIG,
        VALIDATED_ENV,
        SERVER_SEED_PROVIDER,
        EVENT_PUBLISHER,
        EVENT_SUBSCRIBER,
        TICK_SCHEDULER,
        TIMER,
        PLACE_BET_USE_CASE,
        CASHOUT_USE_CASE,
        CURRENT_ROUND_STORE,
        CLIENT_SEED_PROVIDER,
        LOGGER,
        FAILED_EVENT_STORE,
        BET_STORE,
      ],
    },
    {
      provide: GET_ROUND_STATE_USE_CASE,
      useFactory: (
        currentRoundStore: CurrentRoundStore,
      ): GetRoundStateUseCase =>
        new GetRoundStateUseCase(currentRoundStore),
      inject: [CURRENT_ROUND_STORE],
    },
  ],
  exports: [RUN_GAME_LOOP_USE_CASE, GET_ROUND_STATE_USE_CASE],
})
export class EngineModule {}
