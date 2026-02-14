import { randomUUID } from 'crypto';
import { Money } from '@shared/kernel/Money';
import { WalletGateway, WalletResult } from '@betting/application/ports/WalletGateway';

export interface WalletCall {
  playerId: string;
  amount: Money;
  roundId: string;
  betId: string;
}

const SUCCESS_RESULT: WalletResult = {
  success: true,
  transactionId: randomUUID(),
  newBalance: Money.fromCents(9000),
};

export class StubWalletGateway implements WalletGateway {
  readonly debitCalls: WalletCall[] = [];
  readonly creditCalls: WalletCall[] = [];

  private debitOverride: WalletResult | Error | null = null;
  private creditOverride: WalletResult | Error | null = null;

  async debit(
    playerId: string,
    amount: Money,
    roundId: string,
    betId: string,
  ): Promise<WalletResult> {
    this.debitCalls.push({ playerId, amount, roundId, betId });
    if (this.debitOverride instanceof Error) throw this.debitOverride;
    return this.debitOverride ?? SUCCESS_RESULT;
  }

  async credit(
    playerId: string,
    amount: Money,
    roundId: string,
    betId: string,
  ): Promise<WalletResult> {
    this.creditCalls.push({ playerId, amount, roundId, betId });
    if (this.creditOverride instanceof Error) throw this.creditOverride;
    return this.creditOverride ?? SUCCESS_RESULT;
  }

  async getBalance(): Promise<Money> {
    return Money.fromCents(10000);
  }

  failNextDebit(error: WalletResult | Error): void {
    this.debitOverride = error;
  }

  failNextCredit(error: WalletResult | Error): void {
    this.creditOverride = error;
  }

  reset(): void {
    this.debitCalls.length = 0;
    this.creditCalls.length = 0;
    this.debitOverride = null;
    this.creditOverride = null;
  }
}
