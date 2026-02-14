import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PG_POOL } from './db.module';
import * as schema from './schema';

@Injectable()
export class DbService {
  public readonly drizzle: NodePgDatabase<typeof schema>;
  public readonly pool: Pool;

  constructor(@Inject(PG_POOL) pool: Pool) {
    this.pool = pool;
    this.drizzle = drizzle(pool, { schema });
  }

  /** Hot path: raw SQL for wallet transaction insert (~0.5ms) */
  async insertWalletTxRaw(tx: {
    id: string;
    playerId: string;
    operatorId: string;
    type: 'BET' | 'WIN' | 'ROLLBACK';
    requestUuid: string;
    transactionUuid: string;
    refTxUuid: string | null;
    roundId: string;
    amount: string;
    currency: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO game.wallet_transactions
        (id, player_id, operator_id, type, request_uuid, transaction_uuid, ref_transaction_uuid, round_id, amount, currency, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
      [
        tx.id,
        tx.playerId,
        tx.operatorId,
        tx.type,
        tx.requestUuid,
        tx.transactionUuid,
        tx.refTxUuid,
        tx.roundId,
        tx.amount,
        tx.currency,
        tx.status,
      ],
    );
  }

  /** Hot path: raw SQL to update wallet transaction status */
  async updateWalletTxStatusRaw(
    requestUuid: string,
    status: 'COMPLETED' | 'FAILED' | 'ROLLED_BACK',
    operatorResponse: unknown,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE game.wallet_transactions SET status = $1, operator_response = $2 WHERE request_uuid = $3`,
      [status, JSON.stringify(operatorResponse), requestUuid],
    );
  }

  /** Hot path: bulk settle losing bets in a single query */
  async settleLosingBets(roundId: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE game.bets SET status = 'LOST' WHERE round_id = $1 AND status = 'PENDING'`,
      [roundId],
    );
    return result.rowCount ?? 0;
  }

  /** Hot path: update bet on successful cashout */
  async recordCashoutRaw(
    betId: string,
    cashoutMultiplier: string,
    payout: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE game.bets SET status = 'WON', cashout_multiplier = $1, payout = $2 WHERE id = $3`,
      [cashoutMultiplier, payout, betId],
    );
  }

  /** Hot path: record crash point when round crashes */
  async recordCrashPointRaw(
    roundId: string,
    crashPoint: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE game.rounds SET crash_point = $1, status = 'CRASHED', crashed_at = NOW() WHERE id = $2`,
      [crashPoint, roundId],
    );
  }
}
