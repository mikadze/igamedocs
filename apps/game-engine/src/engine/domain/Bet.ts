import { BetStatus } from '@engine/domain/BetStatus';
import { Money } from '@shared/kernel/Money';
import { BetNotActiveError, InvalidStateTransition } from '@shared/kernel/DomainError';

export class Bet {
  private _status: BetStatus = BetStatus.PENDING;
  private _cashoutMultiplier?: number;
  private _payout?: Money;

  constructor(
    readonly id: string,
    readonly playerId: string,
    readonly roundId: string,
    readonly amount: Money,
    readonly autoCashout?: number,
  ) {}

  get status(): BetStatus {
    return this._status;
  }

  get cashoutMultiplier(): number | undefined {
    return this._cashoutMultiplier;
  }

  get payout(): Money | undefined {
    return this._payout;
  }

  activate(): void {
    if (this._status !== BetStatus.PENDING) {
      throw new InvalidStateTransition(`Cannot activate bet in state ${this._status}`);
    }
    this._status = BetStatus.ACTIVE;
  }

  cashout(multiplier: number): Money {
    if (this._status !== BetStatus.ACTIVE) {
      throw new BetNotActiveError(`Cannot cashout bet in state ${this._status}`);
    }
    this._status = BetStatus.WON;
    this._cashoutMultiplier = multiplier;
    this._payout = this.amount.multiplyByMultiplier(multiplier);
    return this._payout;
  }

  lose(): void {
    if (this._status !== BetStatus.ACTIVE) {
      throw new BetNotActiveError(`Cannot lose bet in state ${this._status}`);
    }
    this._status = BetStatus.LOST;
    this._payout = Money.zero();
  }

  shouldAutoCashout(currentMultiplier: number): boolean {
    return this.autoCashout !== undefined && currentMultiplier >= this.autoCashout;
  }
}
