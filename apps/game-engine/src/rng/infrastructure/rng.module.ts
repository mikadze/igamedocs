import { Module } from '@nestjs/common';
import { MessagingModule } from '@messaging/messaging.module';
import { LOGGER } from '@messaging/tokens';
import { Logger } from '@shared/ports/Logger';
import { RotatingSeedChainProvider } from '@rng/infrastructure/RotatingSeedChainProvider';

export const SERVER_SEED_PROVIDER = 'ServerSeedProvider';

const SEED_CHAIN_LENGTH = 10_000;

@Module({
  imports: [MessagingModule],
  providers: [
    {
      provide: SERVER_SEED_PROVIDER,
      useFactory: (logger: Logger): RotatingSeedChainProvider =>
        new RotatingSeedChainProvider(SEED_CHAIN_LENGTH, logger),
      inject: [LOGGER],
    },
  ],
  exports: [SERVER_SEED_PROVIDER],
})
export class RngModule {}
