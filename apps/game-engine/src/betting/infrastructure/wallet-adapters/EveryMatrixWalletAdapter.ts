import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Money } from '@shared/kernel/Money';
import {
  WalletGateway,
  WalletResult,
} from '@betting/application/ports/WalletGateway';

const DEFAULT_BALANCE_CENTS = 1_000_000; // $10,000

@Injectable()
export class EveryMatrixWalletAdapter implements WalletGateway {
  async debit(
    _playerId: string,
    _amount: Money,
    _roundId: string,
    _betId: string,
  ): Promise<WalletResult> {
    return {
      success: true,
      transactionId: randomUUID(),
      newBalance: Money.fromCents(DEFAULT_BALANCE_CENTS),
    };
  }

  async credit(
    _playerId: string,
    _amount: Money,
    _roundId: string,
    _betId: string,
  ): Promise<WalletResult> {
    return {
      success: true,
      transactionId: randomUUID(),
      newBalance: Money.fromCents(DEFAULT_BALANCE_CENTS),
    };
  }

  async getBalance(_playerId: string): Promise<Money> {
    return Money.fromCents(DEFAULT_BALANCE_CENTS);
  }
}
