import { Injectable, Inject, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { DbService } from '../db/db.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { AdapterFactory } from './adapters/adapter.factory';
import { WalletResponse } from './interfaces/wallet-adapter.interface';

const BALANCE_CACHE_TTL = 10; // 10 seconds

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly db: DbService,
    private readonly adapterFactory: AdapterFactory,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Get player balance — Redis cache first, fallback to operator API.
   */
  async getBalance(
    operatorId: string,
    operatorToken: string,
    playerId: string,
  ): Promise<{ balance: number; currency: string; cached: boolean }> {
    const cacheKey = `balance:${operatorId}:${playerId}`;

    // Try Redis cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return { ...parsed, cached: true };
    }

    // Thundering herd protection: use SETNX lock so only one request
    // calls the operator API when cache is cold.
    const lockKey = `${cacheKey}:lock`;
    const acquired = await this.redis.set(lockKey, '1', 'EX', 5, 'NX');

    if (!acquired) {
      // Another request is fetching — wait briefly and retry cache
      await new Promise((resolve) => setTimeout(resolve, 200));
      const retried = await this.redis.get(cacheKey);
      if (retried) {
        const parsed = JSON.parse(retried);
        return { ...parsed, cached: true };
      }
      // Still no cache — fall through to API call
    }

    try {
      const adapter = await this.adapterFactory.getAdapter(operatorId);
      const result = await adapter.balance(operatorToken);

      await this.redis.setex(cacheKey, BALANCE_CACHE_TTL, JSON.stringify(result));

      return { ...result, cached: false };
    } finally {
      await this.redis.del(lockKey);
    }
  }

  /**
   * Place a bet — call operator wallet /bet endpoint.
   * Records wallet transaction for audit and idempotency.
   */
  async placeBet(params: {
    operatorId: string;
    operatorToken: string;
    playerId: string;
    roundId: string;
    amount: string;
    currency: string;
  }): Promise<WalletResponse> {
    const requestUuid = randomUUID();
    const transactionUuid = randomUUID();
    const txId = randomUUID();

    // Insert PENDING wallet transaction (raw pg for speed)
    await this.db.insertWalletTxRaw({
      id: txId,
      playerId: params.playerId,
      operatorId: params.operatorId,
      type: 'BET',
      requestUuid,
      transactionUuid,
      refTxUuid: null,
      roundId: params.roundId,
      amount: params.amount,
      currency: params.currency,
      status: 'PENDING',
    });

    try {
      const adapter = await this.adapterFactory.getAdapter(params.operatorId);
      const result = await adapter.bet({
        token: params.operatorToken,
        requestUuid,
        round: params.roundId,
        amount: Number(params.amount),
        currency: params.currency,
        transactionUuid,
      });

      // Update transaction as COMPLETED
      await this.db.updateWalletTxStatusRaw(requestUuid, 'COMPLETED', result);

      // Update Redis balance cache with operator's returned balance
      const cacheKey = `balance:${params.operatorId}:${params.playerId}`;
      await this.redis.setex(
        cacheKey,
        BALANCE_CACHE_TTL,
        JSON.stringify({ balance: result.balance, currency: params.currency }),
      );

      return result;
    } catch (err) {
      // Update transaction as FAILED
      await this.db.updateWalletTxStatusRaw(requestUuid, 'FAILED', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }
  }

  /**
   * Credit winnings — call operator wallet /win endpoint.
   */
  async creditWin(params: {
    operatorId: string;
    operatorToken: string;
    playerId: string;
    roundId: string;
    amount: string;
    currency: string;
    referenceTxUuid: string;
  }): Promise<WalletResponse> {
    const requestUuid = randomUUID();
    const transactionUuid = randomUUID();
    const txId = randomUUID();

    await this.db.insertWalletTxRaw({
      id: txId,
      playerId: params.playerId,
      operatorId: params.operatorId,
      type: 'WIN',
      requestUuid,
      transactionUuid,
      refTxUuid: params.referenceTxUuid,
      roundId: params.roundId,
      amount: params.amount,
      currency: params.currency,
      status: 'PENDING',
    });

    try {
      const adapter = await this.adapterFactory.getAdapter(params.operatorId);
      const result = await adapter.win({
        token: params.operatorToken,
        requestUuid,
        round: params.roundId,
        amount: Number(params.amount),
        currency: params.currency,
        transactionUuid,
        referenceTransactionUuid: params.referenceTxUuid,
      });

      await this.db.updateWalletTxStatusRaw(requestUuid, 'COMPLETED', result);

      // Update Redis balance cache
      const cacheKey = `balance:${params.operatorId}:${params.playerId}`;
      await this.redis.setex(
        cacheKey,
        BALANCE_CACHE_TTL,
        JSON.stringify({ balance: result.balance, currency: params.currency }),
      );

      return result;
    } catch (err) {
      await this.db.updateWalletTxStatusRaw(requestUuid, 'FAILED', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }
  }

  /**
   * Rollback a failed bet — call operator wallet /rollback endpoint.
   */
  async rollback(params: {
    operatorId: string;
    operatorToken: string;
    playerId: string;
    roundId: string;
    referenceTxUuid: string;
  }): Promise<WalletResponse> {
    const requestUuid = randomUUID();
    const transactionUuid = randomUUID();
    const txId = randomUUID();

    await this.db.insertWalletTxRaw({
      id: txId,
      playerId: params.playerId,
      operatorId: params.operatorId,
      type: 'ROLLBACK',
      requestUuid,
      transactionUuid,
      refTxUuid: params.referenceTxUuid,
      roundId: params.roundId,
      amount: '0',
      currency: '',
      status: 'PENDING',
    });

    try {
      const adapter = await this.adapterFactory.getAdapter(params.operatorId);
      const result = await adapter.rollback({
        token: params.operatorToken,
        requestUuid,
        round: params.roundId,
        transactionUuid,
        referenceTransactionUuid: params.referenceTxUuid,
      });

      await this.db.updateWalletTxStatusRaw(
        requestUuid,
        'ROLLED_BACK',
        result,
      );
      return result;
    } catch (err) {
      await this.db.updateWalletTxStatusRaw(requestUuid, 'FAILED', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }
  }
}
