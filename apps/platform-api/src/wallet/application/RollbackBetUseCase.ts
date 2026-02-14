import { randomUUID } from 'crypto';
import { Money } from '@shared/kernel/Money';
import { WalletTransaction, WalletTransactionType } from '../domain/WalletTransaction';
import { isWalletSuccess } from '../domain/WalletResult';
import { OperatorWalletGateway } from './ports/OperatorWalletGateway';
import { WalletTransactionStore } from './ports/WalletTransactionStore';
import { RollbackBetCommand } from './commands/RollbackBetCommand';
import { RollbackBetResult } from './commands/RollbackBetResult';

export class RollbackBetUseCase {
  constructor(
    private readonly gateway: OperatorWalletGateway,
    private readonly txStore: WalletTransactionStore,
  ) {}

  async execute(command: RollbackBetCommand): Promise<RollbackBetResult> {
    const tx = new WalletTransaction(
      randomUUID(),
      command.playerId,
      command.operatorId,
      WalletTransactionType.ROLLBACK,
      randomUUID(),
      randomUUID(),
      command.referenceTransactionUuid,
      command.roundId,
      Money.zero(),
      command.currency,
    );

    await this.txStore.save(tx);

    const result = await this.gateway.rollback({
      token: command.operatorToken,
      requestUuid: tx.requestUuid,
      transactionUuid: tx.transactionUuid,
      referenceTransactionUuid: command.referenceTransactionUuid,
      roundId: command.roundId,
    });

    if (isWalletSuccess(result)) {
      tx.rollback();
      await this.txStore.updateStatus(tx.requestUuid, tx.status, result);
      return { success: true, transactionUuid: tx.transactionUuid, balance: result.balance };
    }

    tx.fail();
    await this.txStore.updateStatus(tx.requestUuid, tx.status, result);
    return { success: false, error: result.error };
  }
}
