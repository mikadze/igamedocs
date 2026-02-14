import { Logger } from '@nestjs/common';
import { Pool } from 'undici';
import {
  WalletAdapter,
  BalanceResponse,
  BetParams,
  WinParams,
  RollbackParams,
  WalletResponse,
} from '../interfaces/wallet-adapter.interface';
import { SignatureService } from '../../crypto/signature.service';

interface OperatorConfig {
  walletBaseUrl: string;
  aviatrixPrivateKey: string;
}

/**
 * Generic seamless wallet adapter using undici connection pools.
 * Implements the standard iGaming wallet protocol (balance/bet/win/rollback).
 */
export class GenericSeamlessAdapter implements WalletAdapter {
  private readonly logger = new Logger(GenericSeamlessAdapter.name);
  private readonly pool: Pool;
  private readonly signatureService: SignatureService;
  private readonly privateKey: string;

  constructor(config: OperatorConfig, signatureService: SignatureService) {
    this.pool = new Pool(config.walletBaseUrl, {
      connections: 100,
      pipelining: 1,
      keepAliveTimeout: 30_000,
      headersTimeout: 3_000,
      bodyTimeout: 3_000,
    });
    this.signatureService = signatureService;
    this.privateKey = config.aviatrixPrivateKey;
  }

  async balance(token: string): Promise<BalanceResponse> {
    return this.request<BalanceResponse>('/wallet/balance', { token });
  }

  async bet(params: BetParams): Promise<WalletResponse> {
    return this.request<WalletResponse>('/wallet/bet', {
      token: params.token,
      request_uuid: params.requestUuid,
      round: params.round,
      amount: params.amount,
      currency: params.currency,
      transaction_uuid: params.transactionUuid,
    });
  }

  async win(params: WinParams): Promise<WalletResponse> {
    return this.request<WalletResponse>('/wallet/win', {
      token: params.token,
      request_uuid: params.requestUuid,
      round: params.round,
      amount: params.amount,
      currency: params.currency,
      transaction_uuid: params.transactionUuid,
      reference_transaction_uuid: params.referenceTransactionUuid,
    });
  }

  async rollback(params: RollbackParams): Promise<WalletResponse> {
    return this.request<WalletResponse>('/wallet/rollback', {
      token: params.token,
      request_uuid: params.requestUuid,
      round: params.round,
      transaction_uuid: params.transactionUuid,
      reference_transaction_uuid: params.referenceTransactionUuid,
    });
  }

  private async request<T>(path: string, payload: unknown): Promise<T> {
    const body = JSON.stringify(payload);
    const signature = this.signatureService.sign(body, this.privateKey);

    const { statusCode, body: responseBody } = await this.pool.request({
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Aviatrix-Signature': signature,
      },
      body,
    });

    const text = await responseBody.text();

    if (statusCode >= 400) {
      this.logger.error(
        `Wallet call ${path} failed: ${statusCode} — ${text}`,
      );
      throw new Error(`Wallet API error: ${statusCode} — ${text}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.logger.error(`Wallet call ${path} returned invalid JSON: ${text}`);
      throw new Error(`Wallet API returned invalid JSON from ${path}`);
    }

    // Minimal response shape validation
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(`Wallet API returned non-object from ${path}`);
    }

    return parsed as T;
  }

  async destroy() {
    await this.pool.close();
  }
}
