import { randomUUID } from 'crypto';
import { Money } from '@shared/kernel/Money';
import { WalletGateway } from '@betting/application/ports/WalletGateway';
import { FailedCreditStore } from '@betting/application/ports/FailedCreditStore';
import { EventPublisher } from '@engine/application/ports/EventPublisher';
import { CashoutCommand } from '@betting/application/commands/CashoutCommand';
import { CashoutResult } from '@betting/application/commands/CashoutResult';
import { FailedCredit } from '@betting/application/commands/FailedCredit';
import { Round } from '@engine/domain/Round';
import { RoundState } from '@engine/domain/RoundState';

export class CashoutUseCase {
  constructor(
    private readonly walletGateway: WalletGateway,
    private readonly failedCreditStore: FailedCreditStore,
    private readonly eventPublisher: EventPublisher,
  ) {}

  execute(cmd: CashoutCommand, round: Round): CashoutResult {
    if (cmd.roundId !== round.id) {
      return { success: false, error: 'ROUND_MISMATCH' };
    }

    if (round.state !== RoundState.RUNNING) {
      return { success: false, error: 'ROUND_NOT_RUNNING' };
    }

    const bet = round.bets.getById(cmd.betId);
    if (!bet) {
      return { success: false, error: 'BET_NOT_FOUND' };
    }

    if (bet.playerId !== cmd.playerId) {
      return { success: false, error: 'NOT_BET_OWNER' };
    }

    try {
      const payout = round.cashout(cmd.betId);
      this.walletGateway.credit(
        cmd.playerId, payout, round.id, cmd.betId,
      ).then((walletResult) => {
        if (!walletResult.success) {
          this.persistFailure(cmd.playerId, round.id, cmd.betId, payout, walletResult.error);
        }
      }).catch((err: unknown) => {
        const reason = err instanceof Error ? err.message : 'UNKNOWN';
        this.persistFailure(cmd.playerId, round.id, cmd.betId, payout, reason);
      });
      return { success: true, payoutCents: payout.toCents() };
    } catch {
      return { success: false, error: 'BET_NOT_ACTIVE' };
    }
  }

  private persistFailure(
    playerId: string,
    roundId: string,
    betId: string,
    payout: Money,
    reason: string,
  ): void {
    const failed: FailedCredit = {
      id: randomUUID(),
      playerId,
      roundId,
      betId,
      payoutCents: payout.toCents(),
      reason,
      occurredAt: Date.now(),
      retryCount: 0,
      resolved: false,
    };

    this.failedCreditStore.save(failed);
    this.eventPublisher.creditFailed(
      playerId, betId, roundId, payout.toCents(), reason,
    ).catch(() => {});
  }
}
