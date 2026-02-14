import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class CashoutService {
  private readonly logger = new Logger(CashoutService.name);

  constructor(
    private readonly db: DbService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * Process a player cashout — credit winnings via operator wallet.
   * Called by game engine (Engineer 2) when a player cashes out.
   */
  async processCashout(params: {
    operatorId: string;
    operatorToken: string;
    playerId: string;
    roundId: string;
    betId: string;
    betAmount: string;
    cashoutMultiplier: string;
    currency: string;
    betTransactionUuid: string;
  }) {
    // Integer-scaled arithmetic to avoid floating-point errors.
    // Scale to 4 decimal places (10000), multiply, then scale back.
    const betCents = Math.round(Number(params.betAmount) * 10000);
    const multiplierScaled = Math.round(Number(params.cashoutMultiplier) * 10000);
    const payoutCents = Math.round((betCents * multiplierScaled) / 10000);
    const payout = (payoutCents / 10000).toFixed(4);

    // Credit winnings to operator wallet
    const result = await this.walletService.creditWin({
      operatorId: params.operatorId,
      operatorToken: params.operatorToken,
      playerId: params.playerId,
      roundId: params.roundId,
      amount: payout,
      currency: params.currency,
      referenceTxUuid: params.betTransactionUuid,
    });

    // Record cashout on bet (raw pg for speed)
    await this.db.recordCashoutRaw(
      params.betId,
      params.cashoutMultiplier,
      payout,
    );

    this.logger.log(
      `Cashout processed: bet=${params.betId} multiplier=${params.cashoutMultiplier} payout=${payout}`,
    );

    return { payout, balance: result.balance };
  }

  /**
   * Settle all losing bets for a crashed round.
   * Called when round.status transitions to CRASHED.
   */
  async settleLosingBets(roundId: string): Promise<number> {
    const count = await this.db.settleLosingBets(roundId);
    this.logger.log(
      `Settled ${count} losing bets for round ${roundId}`,
    );
    return count;
  }

  /**
   * Rollback a bet if round errors/cancels.
   */
  async rollbackBet(params: {
    operatorId: string;
    operatorToken: string;
    playerId: string;
    roundId: string;
    betTransactionUuid: string;
  }) {
    return this.walletService.rollback({
      operatorId: params.operatorId,
      operatorToken: params.operatorToken,
      playerId: params.playerId,
      roundId: params.roundId,
      referenceTxUuid: params.betTransactionUuid,
    });
  }
}
