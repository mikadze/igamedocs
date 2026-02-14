import { SessionExpiredError } from '@shared/kernel/DomainError';

export class PlayerSession {
  constructor(
    readonly sessionId: string,
    readonly playerId: string,
    readonly operatorId: string,
    readonly operatorPlayerId: string,
    readonly operatorToken: string,
    readonly currency: string,
    readonly platform: string,
    readonly expiresAt: Date,
  ) {
    if (!sessionId) throw new SessionExpiredError('sessionId is required');
    if (!playerId) throw new SessionExpiredError('playerId is required');
    if (!operatorId) throw new SessionExpiredError('operatorId is required');
    /** operatorPlayerId intentionally not validated — some operators omit it. */
    if (!operatorToken) throw new SessionExpiredError('operatorToken is required');
    if (!currency || currency.length !== 3) {
      throw new SessionExpiredError('currency must be a 3-letter ISO code');
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      sessionId: this.sessionId,
      playerId: this.playerId,
      operatorId: this.operatorId,
      operatorPlayerId: this.operatorPlayerId,
      operatorToken: '[REDACTED]',
      currency: this.currency,
      platform: this.platform,
      expiresAt: this.expiresAt,
    };
  }

  isExpired(now: Date = new Date()): boolean {
    return now >= this.expiresAt;
  }

  /** Token validity must NOT be checked for win/rollback transactions (industry standard). */
  isValidForWalletOps(): boolean {
    return true;
  }
}
