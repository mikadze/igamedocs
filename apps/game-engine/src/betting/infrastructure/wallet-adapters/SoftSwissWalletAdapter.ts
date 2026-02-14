import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Money } from '@shared/kernel/Money';
import {
  WalletGateway,
  WalletResult,
} from '@betting/application/ports/WalletGateway';

// ── Injection token ─────────────────────────────────────────
export const SOFTSWISS_CONFIG = 'SOFTSWISS_CONFIG';

export interface SoftSwissConfig {
  baseUrl: string;
  casinoId: string;
  authToken: string;
}

// ── SoftSwiss API DTOs ──────────────────────────────────────
interface SoftSwissDebitRequest {
  casino_id: string;
  user_id: string;
  amount: number;
  currency: string;
  round_id: string;
  transaction_id: string;
  type: 'bet';
}

interface SoftSwissCreditRequest {
  casino_id: string;
  user_id: string;
  amount: number;
  currency: string;
  round_id: string;
  transaction_id: string;
  type: 'win';
}

interface SoftSwissBalanceRequest {
  casino_id: string;
  user_id: string;
  currency: string;
}

interface SoftSwissApiResponse {
  status: 'ok' | 'error';
  balance: number;
  transaction_id?: string;
  error_code?: string;
}

// ── Endpoint paths ──────────────────────────────────────────
const ENDPOINTS = {
  DEBIT: '/wallet/debit',
  CREDIT: '/wallet/credit',
  BALANCE: '/wallet/balance',
} as const;

const DEFAULT_BALANCE_CENTS = 1_000_000; // $10,000

@Injectable()
export class SoftSwissWalletAdapter implements WalletGateway {
  private readonly balances = new Map<string, Money>();

  constructor(
    @Inject(SOFTSWISS_CONFIG) private readonly config: SoftSwissConfig,
  ) {}

  async debit(
    playerId: string,
    amount: Money,
    roundId: string,
    betId: string,
  ): Promise<WalletResult> {
    const transactionId = randomUUID();

    const request: SoftSwissDebitRequest = {
      casino_id: this.config.casinoId,
      user_id: playerId,
      amount: amount.toCents(),
      currency: 'USD',
      round_id: roundId,
      transaction_id: transactionId,
      type: 'bet',
    };

    const response = await this.httpPost<SoftSwissApiResponse>(
      ENDPOINTS.DEBIT,
      request,
    );

    if (response.status === 'error') {
      return { success: false, error: this.mapErrorCode(response.error_code) };
    }

    return {
      success: true,
      transactionId: response.transaction_id ?? transactionId,
      newBalance: Money.fromCents(response.balance),
    };
  }

  async credit(
    playerId: string,
    amount: Money,
    roundId: string,
    betId: string,
  ): Promise<WalletResult> {
    const transactionId = randomUUID();

    const request: SoftSwissCreditRequest = {
      casino_id: this.config.casinoId,
      user_id: playerId,
      amount: amount.toCents(),
      currency: 'USD',
      round_id: roundId,
      transaction_id: transactionId,
      type: 'win',
    };

    const response = await this.httpPost<SoftSwissApiResponse>(
      ENDPOINTS.CREDIT,
      request,
    );

    if (response.status === 'error') {
      return { success: false, error: this.mapErrorCode(response.error_code) };
    }

    return {
      success: true,
      transactionId: response.transaction_id ?? transactionId,
      newBalance: Money.fromCents(response.balance),
    };
  }

  async getBalance(playerId: string): Promise<Money> {
    const request: SoftSwissBalanceRequest = {
      casino_id: this.config.casinoId,
      user_id: playerId,
      currency: 'USD',
    };

    const response = await this.httpPost<SoftSwissApiResponse>(
      ENDPOINTS.BALANCE,
      request,
    );

    return Money.fromCents(response.balance);
  }

  // ── Stubbed HTTP layer ────────────────────────────────────
  // Replace with real fetch() when integrating with live SoftSwiss API.
  private async httpPost<T>(
    _endpoint: string,
    payload: unknown,
  ): Promise<T> {
    return this.simulateResponse(payload) as T;
  }

  private simulateResponse(payload: unknown): SoftSwissApiResponse {
    const req = payload as Record<string, unknown>;
    const playerId = req.user_id as string;
    const amountCents = req.amount as number | undefined;
    const type = req.type as string | undefined;

    const balance = this.getOrCreateBalance(playerId);

    if (type === 'bet' && amountCents !== undefined) {
      const debitAmount = Money.fromCents(amountCents);
      if (debitAmount.isGreaterThan(balance)) {
        return {
          status: 'error',
          balance: balance.toCents(),
          error_code: 'insufficient_money',
        };
      }
      const newBalance = balance.subtract(debitAmount);
      this.balances.set(playerId, newBalance);
      return {
        status: 'ok',
        balance: newBalance.toCents(),
        transaction_id: randomUUID(),
      };
    }

    if (type === 'win' && amountCents !== undefined) {
      const creditAmount = Money.fromCents(amountCents);
      const newBalance = balance.add(creditAmount);
      this.balances.set(playerId, newBalance);
      return {
        status: 'ok',
        balance: newBalance.toCents(),
        transaction_id: randomUUID(),
      };
    }

    // Balance inquiry
    return { status: 'ok', balance: balance.toCents() };
  }

  private getOrCreateBalance(playerId: string): Money {
    let balance = this.balances.get(playerId);
    if (!balance) {
      balance = Money.fromCents(DEFAULT_BALANCE_CENTS);
      this.balances.set(playerId, balance);
    }
    return balance;
  }

  private mapErrorCode(
    code?: string,
  ): 'INSUFFICIENT_FUNDS' | 'PLAYER_BLOCKED' | 'TIMEOUT' {
    switch (code) {
      case 'insufficient_money':
        return 'INSUFFICIENT_FUNDS';
      case 'user_blocked':
        return 'PLAYER_BLOCKED';
      default:
        return 'TIMEOUT';
    }
  }
}
