import { randomUUID } from 'crypto';
import { GameConfig } from '@engine/domain/GameConfig';
import { Money } from '@shared/kernel/Money';
import { Bet } from '@betting/domain/Bet';
import { WalletGateway } from '@betting/application/ports/WalletGateway';
import { BetStore } from '@betting/application/ports/BetStore';
import { FailedCreditStore } from '@betting/application/ports/FailedCreditStore';
import { PlaceBetCommand } from '@betting/application/commands/PlaceBetCommand';
import { PlaceBetResult } from '@betting/application/commands/PlaceBetResult';
import { FailedCredit } from '@betting/application/commands/FailedCredit';
import { toBetSnapshot } from '@betting/application/mappers/toBetSnapshot';
import { Round } from '@engine/domain/Round';
import { Logger } from '@engine/application/ports/Logger';

export class PlaceBetUseCase {
  constructor(
    private readonly config: GameConfig,
    private readonly walletGateway: WalletGateway,
    private readonly betStore: BetStore,
    private readonly failedCreditStore: FailedCreditStore,
    private readonly logger: Logger,
  ) { }

  async execute(command: PlaceBetCommand, round: Round): Promise<PlaceBetResult> {
    if (command.amountCents < this.config.minBetCents) {
      return { success: false, error: 'BELOW_MIN_BET' };
    }
    if (command.amountCents > this.config.maxBetCents) {
      return { success: false, error: 'ABOVE_MAX_BET' };
    }

    const amount = Money.fromCents(command.amountCents);
    const betId = randomUUID();

    const walletResult = await this.walletGateway.debit(
      command.playerId,
      amount,
      command.roundId,
      betId,
    );

    if (!walletResult.success) {
      const errorMap = {
        INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
        PLAYER_BLOCKED: 'PLAYER_BLOCKED',
        TIMEOUT: 'WALLET_TIMEOUT',
      } as const;
      return { success: false, error: errorMap[walletResult.error] };
    }

    const bet = new Bet(
      betId,
      command.playerId,
      command.roundId,
      amount,
      command.autoCashout,
    );

    try {
      round.addBet(bet);
      this.betStore.add(bet);
      return { success: true, snapshot: toBetSnapshot(bet) };
    } catch {
      this.walletGateway.credit(
        command.playerId, amount, command.roundId, betId,
      ).catch((err: unknown) => {
        this.logger.error('Compensating refund failed', {
          playerId: command.playerId,
          roundId: command.roundId,
          betId,
          amountCents: amount.toCents(),
        });
        this.persistFailure(command.playerId, command.roundId, betId, amount, err);
      });
      return { success: false, error: 'ROUND_NOT_BETTING' };
    }
  }

  private persistFailure(
    playerId: string,
    roundId: string,
    betId: string,
    amount: Money,
    err: unknown,
  ): void {
    const failed: FailedCredit = {
      id: randomUUID(),
      playerId,
      roundId,
      betId,
      payoutCents: amount.toCents(),
      reason: err instanceof Error ? err.message : 'COMPENSATING_REFUND',
      occurredAt: Date.now(),
      retryCount: 0,
      resolved: false,
    };
    this.failedCreditStore.save(failed);
  }
}
