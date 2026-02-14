import { Module } from '@nestjs/common';
import { GameConfigModule } from '@config/config.module';
import { GAME_CONFIG } from '@config/env-config.provider';
import { MessagingModule } from '@messaging/messaging.module';
import { LOGGER, EVENT_PUBLISHER } from '@messaging/tokens';
import { GameConfig } from '@shared/kernel/GameConfig';
import { Logger } from '@shared/ports/Logger';
import { WalletGateway } from '@betting/application/ports/WalletGateway';
import { BetStore } from '@betting/application/ports/BetStore';
import { FailedCreditStore } from '@betting/application/ports/FailedCreditStore';
import { CreditFailedNotifier } from '@betting/application/ports/CreditFailedNotifier';
import { PlaceBetUseCase } from '@betting/application/PlaceBetUseCase';
import { CashoutUseCase } from '@betting/application/CashoutUseCase';
import { InMemoryBetStore } from '@betting/infrastructure/InMemoryBetStore';
import { InMemoryFailedCreditStore } from '@betting/infrastructure/InMemoryFailedCreditStore';
import { EveryMatrixWalletAdapter } from '@betting/infrastructure/wallet-adapters/EveryMatrixWalletAdapter';

export const BET_STORE = 'BetStore';
export const WALLET_GATEWAY = 'WalletGateway';
export const FAILED_CREDIT_STORE = 'FailedCreditStore';
export const CREDIT_FAILED_NOTIFIER = 'CreditFailedNotifier';
export const PLACE_BET_USE_CASE = 'PlaceBetUseCase';
export const CASHOUT_USE_CASE = 'CashoutUseCase';

@Module({
  imports: [GameConfigModule, MessagingModule],
  providers: [
    // ── Port → Implementation mappings ──────────────────
    {
      provide: BET_STORE,
      useFactory: (): BetStore => new InMemoryBetStore(),
    },
    {
      provide: WALLET_GATEWAY,
      useFactory: (): WalletGateway => new EveryMatrixWalletAdapter(),
    },
    {
      provide: FAILED_CREDIT_STORE,
      useFactory: (): FailedCreditStore => new InMemoryFailedCreditStore(),
    },
    {
      provide: CREDIT_FAILED_NOTIFIER,
      useFactory: (publisher: CreditFailedNotifier): CreditFailedNotifier =>
        publisher,
      inject: [EVENT_PUBLISHER],
    },

    // ── Use cases ───────────────────────────────────────
    {
      provide: PLACE_BET_USE_CASE,
      useFactory: (
        config: GameConfig,
        walletGateway: WalletGateway,
        betStore: BetStore,
        failedCreditStore: FailedCreditStore,
        logger: Logger,
      ): PlaceBetUseCase =>
        new PlaceBetUseCase(
          config,
          walletGateway,
          betStore,
          failedCreditStore,
          logger,
        ),
      inject: [GAME_CONFIG, WALLET_GATEWAY, BET_STORE, FAILED_CREDIT_STORE, LOGGER],
    },
    {
      provide: CASHOUT_USE_CASE,
      useFactory: (
        walletGateway: WalletGateway,
        failedCreditStore: FailedCreditStore,
        creditFailedNotifier: CreditFailedNotifier,
      ): CashoutUseCase =>
        new CashoutUseCase(
          walletGateway,
          failedCreditStore,
          creditFailedNotifier,
        ),
      inject: [WALLET_GATEWAY, FAILED_CREDIT_STORE, CREDIT_FAILED_NOTIFIER],
    },
  ],
  exports: [PLACE_BET_USE_CASE, CASHOUT_USE_CASE, BET_STORE],
})
export class BettingModule {}
