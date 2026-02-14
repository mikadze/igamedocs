// SYNC: base classes copied from apps/game-engine/src/shared/kernel/DomainError.ts

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// --- Shared with game-engine (identical) ---
export class InvalidMoneyError extends DomainError {}
export class InvalidStateTransition extends DomainError {}
export class BetNotActiveError extends DomainError {}
export class InvalidCrashPointError extends DomainError {}
export class InvalidSeedError extends DomainError {}

// --- Platform-API specific ---
export class InvalidLaunchRequestError extends DomainError {}
export class SessionExpiredError extends DomainError {}
export class InvalidWalletTransactionError extends DomainError {}
