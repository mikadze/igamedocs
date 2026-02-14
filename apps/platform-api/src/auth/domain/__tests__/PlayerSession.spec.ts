import { PlayerSession } from '../PlayerSession';
import { SessionExpiredError } from '@shared/kernel/DomainError';

const validParams = {
  sessionId: 'sess-1',
  playerId: 'player-1',
  operatorId: 'op-1',
  operatorPlayerId: 'ext-player-1',
  operatorToken: 'token-abc',
  currency: 'EUR',
  platform: 'GPL_DESKTOP',
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
};

describe('PlayerSession', () => {
  it('constructs successfully with valid fields', () => {
    const session = new PlayerSession(
      validParams.sessionId,
      validParams.playerId,
      validParams.operatorId,
      validParams.operatorPlayerId,
      validParams.operatorToken,
      validParams.currency,
      validParams.platform,
      validParams.expiresAt,
    );
    expect(session.sessionId).toBe('sess-1');
    expect(session.playerId).toBe('player-1');
    expect(session.currency).toBe('EUR');
  });

  describe('isExpired', () => {
    it('returns false when now is before expiresAt', () => {
      const session = new PlayerSession(
        validParams.sessionId,
        validParams.playerId,
        validParams.operatorId,
        validParams.operatorPlayerId,
        validParams.operatorToken,
        validParams.currency,
        validParams.platform,
        new Date('2030-01-01'),
      );
      expect(session.isExpired(new Date('2025-01-01'))).toBe(false);
    });

    it('returns true when now is at expiresAt', () => {
      const expiresAt = new Date('2025-06-01T12:00:00Z');
      const session = new PlayerSession(
        validParams.sessionId,
        validParams.playerId,
        validParams.operatorId,
        validParams.operatorPlayerId,
        validParams.operatorToken,
        validParams.currency,
        validParams.platform,
        expiresAt,
      );
      expect(session.isExpired(expiresAt)).toBe(true);
    });

    it('returns true when now is after expiresAt', () => {
      const session = new PlayerSession(
        validParams.sessionId,
        validParams.playerId,
        validParams.operatorId,
        validParams.operatorPlayerId,
        validParams.operatorToken,
        validParams.currency,
        validParams.platform,
        new Date('2020-01-01'),
      );
      expect(session.isExpired(new Date('2025-01-01'))).toBe(true);
    });
  });

  describe('isValidForWalletOps', () => {
    it('always returns true (industry standard)', () => {
      const session = new PlayerSession(
        validParams.sessionId,
        validParams.playerId,
        validParams.operatorId,
        validParams.operatorPlayerId,
        validParams.operatorToken,
        validParams.currency,
        validParams.platform,
        validParams.expiresAt,
      );
      expect(session.isValidForWalletOps()).toBe(true);
    });
  });

  describe('validation', () => {
    it('throws for missing sessionId', () => {
      expect(
        () =>
          new PlayerSession('', validParams.playerId, validParams.operatorId, validParams.operatorPlayerId, validParams.operatorToken, validParams.currency, validParams.platform, validParams.expiresAt),
      ).toThrow(SessionExpiredError);
    });

    it('throws for missing playerId', () => {
      expect(
        () =>
          new PlayerSession(validParams.sessionId, '', validParams.operatorId, validParams.operatorPlayerId, validParams.operatorToken, validParams.currency, validParams.platform, validParams.expiresAt),
      ).toThrow(SessionExpiredError);
    });

    it('throws for missing operatorId', () => {
      expect(
        () =>
          new PlayerSession(validParams.sessionId, validParams.playerId, '', validParams.operatorPlayerId, validParams.operatorToken, validParams.currency, validParams.platform, validParams.expiresAt),
      ).toThrow(SessionExpiredError);
    });

    it('throws for missing operatorToken', () => {
      expect(
        () =>
          new PlayerSession(validParams.sessionId, validParams.playerId, validParams.operatorId, validParams.operatorPlayerId, '', validParams.currency, validParams.platform, validParams.expiresAt),
      ).toThrow(SessionExpiredError);
    });

    it('throws for invalid currency (not 3 chars)', () => {
      expect(
        () =>
          new PlayerSession(validParams.sessionId, validParams.playerId, validParams.operatorId, validParams.operatorPlayerId, validParams.operatorToken, 'EU', validParams.platform, validParams.expiresAt),
      ).toThrow(SessionExpiredError);
    });
  });

  describe('toJSON', () => {
    it('redacts operatorToken', () => {
      const session = new PlayerSession(
        validParams.sessionId,
        validParams.playerId,
        validParams.operatorId,
        validParams.operatorPlayerId,
        validParams.operatorToken,
        validParams.currency,
        validParams.platform,
        validParams.expiresAt,
      );
      const json = session.toJSON();
      expect(json.operatorToken).toBe('[REDACTED]');
      expect(json.sessionId).toBe('sess-1');
      expect(json.playerId).toBe('player-1');
    });

    it('redacts token in JSON.stringify', () => {
      const session = new PlayerSession(
        validParams.sessionId,
        validParams.playerId,
        validParams.operatorId,
        validParams.operatorPlayerId,
        validParams.operatorToken,
        validParams.currency,
        validParams.platform,
        validParams.expiresAt,
      );
      const serialized = JSON.stringify(session);
      expect(serialized).toContain('[REDACTED]');
      expect(serialized).not.toContain('token-abc');
    });
  });
});
