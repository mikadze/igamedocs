import { InvalidCrashPointError } from '@shared/kernel/DomainError';
import { Logger } from '@shared/ports/Logger';
import { CashoutCalculation } from '../domain/CashoutCalculation';
import { CreditWinPort } from './ports/CreditWinPort';
import { BetSettlementStore } from './ports/BetSettlementStore';
import { ProcessCashoutCommand } from './commands/ProcessCashoutCommand';
import { ProcessCashoutResult } from './commands/ProcessCashoutResult';

export class ProcessCashoutUseCase {
  constructor(
    private readonly creditWin: CreditWinPort,
    private readonly betSettlementStore: BetSettlementStore,
    private readonly logger: Logger,
  ) {}

  async execute(command: ProcessCashoutCommand): Promise<ProcessCashoutResult> {
    let calc: CashoutCalculation;
    try {
      calc = new CashoutCalculation(command.betAmount, command.cashoutMultiplier);
    } catch (e) {
      if (e instanceof InvalidCrashPointError) {
        return { success: false, error: 'INVALID_MULTIPLIER' };
      }
      throw e;
    }

    const creditResult = await this.creditWin.execute({
      operatorId: command.operatorId,
      operatorToken: command.operatorToken,
      playerId: command.playerId,
      roundId: command.roundId,
      amount: calc.payout,
      currency: command.currency,
      referenceTransactionUuid: command.betTransactionUuid,
    });

    if (!creditResult.success) {
      return { success: false, error: creditResult.error };
    }

    try {
      await this.betSettlementStore.recordCashout(
        command.betId,
        String(command.cashoutMultiplier),
        calc.payout.toDisplay(),
      );
    } catch (e) {
      this.logger.error('Failed to record cashout after successful credit', {
        betId: command.betId,
        roundId: command.roundId,
        playerId: command.playerId,
        payout: calc.payout.toDisplay(),
        error: e instanceof Error ? e.message : String(e),
      });
    }

    return { success: true, payout: calc.payout, balance: creditResult.balance };
  }
}
