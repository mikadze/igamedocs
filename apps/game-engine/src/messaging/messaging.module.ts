import { Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { NatsConnection } from 'nats';
import { GameConfigModule } from '@config/config.module';
import { NatsEventPublisher } from './NatsEventPublisher';
import { NatsEventSubscriber } from './NatsEventSubscriber';
import { natsConnectionProvider } from './nats-connection.provider';
import { ConsoleLogger } from './console-logger.adapter';
import { NATS_CONNECTION, LOGGER, EVENT_PUBLISHER, EVENT_SUBSCRIBER } from './tokens';

@Module({
  imports: [GameConfigModule],
  providers: [
    { provide: LOGGER, useClass: ConsoleLogger },
    natsConnectionProvider,
    { provide: EVENT_PUBLISHER, useClass: NatsEventPublisher },
    { provide: EVENT_SUBSCRIBER, useClass: NatsEventSubscriber },
  ],
  exports: [LOGGER, EVENT_PUBLISHER, EVENT_SUBSCRIBER],
})
export class MessagingModule implements OnApplicationShutdown {
  constructor(
    @Inject(NATS_CONNECTION) private readonly nats: NatsConnection,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    if (!this.nats.isClosed() && !this.nats.isDraining()) {
      await this.nats.drain();
    }
  }
}
