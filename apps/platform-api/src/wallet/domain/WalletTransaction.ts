import { Money } from '@shared/kernel/Money';
import {
  InvalidStateTransition,
  InvalidWalletTransactionError,
} from '@shared/kernel/DomainError';

export enum WalletTransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ROLLED_BACK = 'ROLLED_BACK',
}

export enum WalletTransactionType {
  BET = 'BET',
  WIN = 'WIN',
  ROLLBACK = 'ROLLBACK',
}

export class WalletTransaction {
  private _status: WalletTransactionStatus;

  constructor(
    readonly id: string,
    readonly playerId: string,
    readonly operatorId: string,
    readonly type: WalletTransactionType,
    readonly requestUuid: string,
    readonly transactionUuid: string,
    readonly referenceTransactionUuid: string | null,
    readonly roundId: string,
    readonly amount: Money,
    readonly currency: string,
  ) {
    if (!id) throw new InvalidWalletTransactionError('id is required');
    if (!playerId) throw new InvalidWalletTransactionError('playerId is required');
    if (!operatorId) throw new InvalidWalletTransactionError('operatorId is required');
    if (!requestUuid) throw new InvalidWalletTransactionError('requestUuid is required');
    if (!transactionUuid) throw new InvalidWalletTransactionError('transactionUuid is required');
    if (!roundId) throw new InvalidWalletTransactionError('roundId is required');
    if (!currency || currency.length !== 3) {
      throw new InvalidWalletTransactionError('currency must be a 3-letter ISO code');
    }

    if (type === WalletTransactionType.ROLLBACK && !referenceTransactionUuid) {
      throw new InvalidWalletTransactionError(
        'ROLLBACK transactions must reference the original transaction',
      );
    }

    this._status = WalletTransactionStatus.PENDING;
  }

  get status(): WalletTransactionStatus {
    return this._status;
  }

  /** PENDING -> COMPLETED only. */
  complete(): void {
    if (this._status !== WalletTransactionStatus.PENDING) {
      throw new InvalidStateTransition(
        `Cannot complete transaction in state ${this._status}`,
      );
    }
    this._status = WalletTransactionStatus.COMPLETED;
  }

  /** PENDING -> FAILED only. */
  fail(): void {
    if (this._status !== WalletTransactionStatus.PENDING) {
      throw new InvalidStateTransition(
        `Cannot fail transaction in state ${this._status}`,
      );
    }
    this._status = WalletTransactionStatus.FAILED;
  }

  /** Any state -> ROLLED_BACK. Compensating action always allowed. */
  rollback(): void {
    this._status = WalletTransactionStatus.ROLLED_BACK;
  }
}
