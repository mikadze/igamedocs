import { InvalidCrashPointError } from '@shared/kernel/DomainError';
import { Money } from '@shared/kernel/Money';

export class CashoutCalculation {
  readonly payout: Money;

  constructor(
    readonly betAmount: Money,
    readonly cashoutMultiplier: number,
  ) {
    if (!Number.isFinite(cashoutMultiplier) || cashoutMultiplier < 1.0) {
      throw new InvalidCrashPointError('Cashout multiplier must be >= 1.00');
    }
    this.payout = betAmount.multiplyByMultiplier(cashoutMultiplier);
  }
}
