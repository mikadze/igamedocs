export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidMoneyError extends DomainError {}
export class InvalidStateTransition extends DomainError {}
export class BetNotActiveError extends DomainError {}
export class InvalidCrashPointError extends DomainError {}
export class InvalidSeedError extends DomainError {}
