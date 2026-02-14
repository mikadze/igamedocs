import { isWalletSuccess } from '../domain/WalletResult';
import { OperatorWalletGateway } from './ports/OperatorWalletGateway';
import { BalanceCache } from './ports/BalanceCache';
import { GetBalanceCommand } from './commands/GetBalanceCommand';
import { GetBalanceResult } from './commands/GetBalanceResult';

const BALANCE_CACHE_TTL = 10;
const LOCK_TTL = 5;
const LOCK_WAIT_MS = 200;

export class GetBalanceUseCase {
  constructor(
    private readonly gateway: OperatorWalletGateway,
    private readonly balanceCache: BalanceCache,
  ) {}

  async execute(command: GetBalanceCommand): Promise<GetBalanceResult> {
    const cached = await this.balanceCache.get(command.operatorId, command.playerId);
    if (cached) {
      return { success: true, balance: cached.balance, currency: cached.currency, cached: true };
    }

    const acquired = await this.balanceCache.acquireLock(
      command.operatorId, command.playerId, LOCK_TTL,
    );

    if (!acquired) {
      await this.delay(LOCK_WAIT_MS);
      const retried = await this.balanceCache.get(command.operatorId, command.playerId);
      if (retried) {
        return { success: true, balance: retried.balance, currency: retried.currency, cached: true };
      }
      return { success: false, error: 'TIMEOUT' };
    }

    try {
      const result = await this.gateway.balance(command.operatorToken);

      if (isWalletSuccess(result)) {
        await this.balanceCache.set(
          command.operatorId, command.playerId,
          result.balance, command.currency, BALANCE_CACHE_TTL,
        );
        return { success: true, balance: result.balance, currency: command.currency, cached: false };
      }

      return { success: false, error: result.error };
    } finally {
      if (acquired) {
        await this.balanceCache.releaseLock(command.operatorId, command.playerId);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
