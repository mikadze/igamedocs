import { randomUUID } from 'crypto';
import { WalletTransaction, WalletTransactionType } from '../domain/WalletTransaction';
import { isWalletSuccess } from '../domain/WalletResult';
import { OperatorWalletGateway } from './ports/OperatorWalletGateway';
import { WalletTransactionStore } from './ports/WalletTransactionStore';
import { BalanceCache } from './ports/BalanceCache';
import { PlaceBetCommand } from './commands/PlaceBetCommand';
import { PlaceBetResult } from './commands/PlaceBetResult';

const BALANCE_CACHE_TTL = 10;

export class PlaceBetUseCase {
  constructor(
    private readonly gateway: OperatorWalletGateway,
    private readonly txStore: WalletTransactionStore,
    private readonly balanceCache: BalanceCache,
  ) {}

  async execute(command: PlaceBetCommand): Promise<PlaceBetResult> {
    const tx = new WalletTransaction(
      randomUUID(),
      command.playerId,
      command.operatorId,
      WalletTransactionType.BET,
      randomUUID(),
      randomUUID(),
      null,
      command.roundId,
      command.amount,
      command.currency,
    );

    await this.txStore.save(tx);

    const result = await this.gateway.bet({
      token: command.operatorToken,
      requestUuid: tx.requestUuid,
      transactionUuid: tx.transactionUuid,
      roundId: command.roundId,
      amount: command.amount,
      currency: command.currency,
    });

    if (isWalletSuccess(result)) {
      tx.complete();
      await this.txStore.updateStatus(tx.requestUuid, tx.status, result);
      await this.balanceCache.set(
        command.operatorId, command.playerId,
        result.balance, command.currency, BALANCE_CACHE_TTL,
      );
      return { success: true, transactionUuid: tx.transactionUuid, balance: result.balance };
    }

    tx.fail();
    await this.txStore.updateStatus(tx.requestUuid, tx.status, result);
    return { success: false, error: result.error };
  }
}
