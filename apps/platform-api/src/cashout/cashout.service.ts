import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { DbService } from '../db/db.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class CashoutService {
  private readonly logger = new Logger(CashoutService.name);

  constructor(
    private readonly db: DbService,
    private readonly walletService: WalletService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
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
    const payout = (
      Number(params.betAmount) * Number(params.cashoutMultiplier)
    ).toFixed(4);

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
