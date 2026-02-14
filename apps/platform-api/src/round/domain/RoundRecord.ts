import { InvalidCrashPointError, InvalidStateTransition } from '@shared/kernel/DomainError';

export type RoundStatus = 'WAITING' | 'BETTING' | 'FLYING' | 'CRASHED' | 'SETTLED';

const VALID_TRANSITIONS: Record<RoundStatus, RoundStatus[]> = {
  WAITING: ['BETTING'],
  BETTING: ['FLYING'],
  FLYING: ['CRASHED'],
  CRASHED: ['SETTLED'],
  SETTLED: [],
};

export class RoundRecord {
  private _status: RoundStatus;
  private _crashPoint: string | null;
  private _startedAt: Date | null;
  private _crashedAt: Date | null;
  private _settledAt: Date | null;

  private constructor(
    readonly id: string,
    readonly operatorId: string,
    status: RoundStatus,
    readonly bettingWindowMs: number,
    crashPoint: string | null,
    startedAt: Date | null,
    crashedAt: Date | null,
    settledAt: Date | null,
    readonly createdAt: Date,
  ) {
    this._status = status;
    this._crashPoint = crashPoint;
    this._startedAt = startedAt;
    this._crashedAt = crashedAt;
    this._settledAt = settledAt;
  }

  /** Factory for creating a new round. Starts in WAITING status. */
  static create(id: string, operatorId: string, bettingWindowMs: number): RoundRecord {
    return new RoundRecord(id, operatorId, 'WAITING', bettingWindowMs, null, null, null, null, new Date());
  }

  /** Reconstitute from persistence (database row). */
  static fromPersistence(data: {
    id: string;
    operatorId: string;
    status: RoundStatus;
    bettingWindowMs: number;
    crashPoint: string | null;
    startedAt: Date | null;
    crashedAt: Date | null;
    settledAt: Date | null;
    createdAt: Date;
  }): RoundRecord {
    const past: RoundStatus[] = ['CRASHED', 'SETTLED'];
    if (past.includes(data.status) && data.crashPoint === null) {
      throw new InvalidCrashPointError(
        `Persisted round ${data.id} in ${data.status} must have a crash point`,
      );
    }
    if (data.status !== 'WAITING' && data.status !== 'BETTING' && data.startedAt === null) {
      throw new InvalidStateTransition(
        `Persisted round ${data.id} in ${data.status} must have startedAt`,
      );
    }
    return new RoundRecord(
      data.id,
      data.operatorId,
      data.status,
      data.bettingWindowMs,
      data.crashPoint,
      data.startedAt,
      data.crashedAt,
      data.settledAt,
      data.createdAt,
    );
  }

  get status(): RoundStatus { return this._status; }
  get crashPoint(): string | null { return this._crashPoint; }
  get startedAt(): Date | null { return this._startedAt; }
  get crashedAt(): Date | null { return this._crashedAt; }
  get settledAt(): Date | null { return this._settledAt; }

  /** Enforce: WAITING -> BETTING -> FLYING -> CRASHED -> SETTLED */
  transitionTo(newStatus: RoundStatus): void {
    const allowed = VALID_TRANSITIONS[this._status];
    if (!allowed.includes(newStatus)) {
      throw new InvalidStateTransition(
        `Cannot transition round from ${this._status} to ${newStatus}`,
      );
    }

    this._status = newStatus;

    const now = new Date();
    if (newStatus === 'FLYING') this._startedAt = now;
    if (newStatus === 'CRASHED') this._crashedAt = now;
    if (newStatus === 'SETTLED') this._settledAt = now;
  }

  /** Record crash point. Only valid when status is CRASHED. */
  recordCrash(crashPoint: string): void {
    if (this._status !== 'CRASHED') {
      throw new InvalidStateTransition(
        `Cannot record crash point when round is ${this._status}`,
      );
    }
    const parsed = Number(crashPoint);
    if (!Number.isFinite(parsed) || parsed < 1.0) {
      throw new InvalidCrashPointError(
        `Crash point must be >= 1.00, got ${crashPoint}`,
      );
    }
    this._crashPoint = crashPoint;
  }
}
