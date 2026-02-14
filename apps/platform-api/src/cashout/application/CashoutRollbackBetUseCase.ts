import { RollbackBetPort } from './ports/RollbackBetPort';
import { CashoutRollbackBetCommand } from './commands/CashoutRollbackBetCommand';
import { CashoutRollbackBetResult } from './commands/CashoutRollbackBetResult';

export class CashoutRollbackBetUseCase {
  constructor(
    private readonly walletRollback: RollbackBetPort,
  ) {}

  async execute(command: CashoutRollbackBetCommand): Promise<CashoutRollbackBetResult> {
    const result = await this.walletRollback.execute({
      operatorId: command.operatorId,
      operatorToken: command.operatorToken,
      playerId: command.playerId,
      roundId: command.roundId,
      referenceTransactionUuid: command.betTransactionUuid,
      currency: command.currency,
    });

    if (result.success) {
      return { success: true, balance: result.balance };
    }
    return { success: false, error: result.error };
  }
}
