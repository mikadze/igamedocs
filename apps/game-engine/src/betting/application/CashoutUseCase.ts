import { Money } from '@shared/kernel/Money';
import { WalletGateway } from '@betting/application/ports/WalletGateway';
import { CashoutResult } from '@betting/application/commands/CashoutResult';

export class CashoutUseCase {
  constructor(private readonly walletGateway: WalletGateway) {}

  async creditWinnings(
    playerId: string,
    payout: Money,
    roundId: string,
    betId: string,
  ): Promise<CashoutResult> {
    const walletResult = await this.walletGateway.credit(
      playerId,
      payout,
      roundId,
      betId,
    );

    if (!walletResult.success) {
      return { success: false, error: 'WALLET_TIMEOUT' };
    }

    return { success: true, payoutCents: payout.toCents() };
  }
}
