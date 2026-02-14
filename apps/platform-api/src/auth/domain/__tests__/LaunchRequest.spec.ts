import { LaunchRequest } from '../LaunchRequest';
import { InvalidLaunchRequestError } from '@shared/kernel/DomainError';

const validParams = {
  user: 'player-abc-123',
  token: 'f562a685-a160-4d17-876d-ab3363db331c',
  currency: 'EUR',
  operatorId: 'megacasino',
  gameCode: 'aviatrix_crash',
  platform: 'GPL_DESKTOP',
  lang: 'en',
  lobbyUrl: 'https://megacasino.com',
};

describe('LaunchRequest', () => {
  it('constructs successfully with valid fields', () => {
    const request = new LaunchRequest(validParams);
    expect(request.user).toBe('player-abc-123');
    expect(request.currency).toBe('EUR');
    expect(request.operatorId).toBe('megacasino');
  });

  it('stores optional fields when provided', () => {
    const request = new LaunchRequest({
      ...validParams,
      depositUrl: 'https://megacasino.com/deposit',
      country: 'EE',
      ip: '10.0.0.1',
    });
    expect(request.depositUrl).toBe('https://megacasino.com/deposit');
    expect(request.country).toBe('EE');
    expect(request.ip).toBe('10.0.0.1');
  });

  it('leaves optional fields undefined when omitted', () => {
    const request = new LaunchRequest(validParams);
    expect(request.depositUrl).toBeUndefined();
    expect(request.country).toBeUndefined();
    expect(request.ip).toBeUndefined();
  });

  describe('validation', () => {
    it('rejects demo mode (currency XXX)', () => {
      expect(
        () => new LaunchRequest({ ...validParams, currency: 'XXX' }),
      ).toThrow(InvalidLaunchRequestError);
      expect(
        () => new LaunchRequest({ ...validParams, currency: 'XXX' }),
      ).toThrow('Demo mode');
    });

    it('rejects empty user', () => {
      expect(
        () => new LaunchRequest({ ...validParams, user: '' }),
      ).toThrow(InvalidLaunchRequestError);
    });

    it('rejects whitespace-only user', () => {
      expect(
        () => new LaunchRequest({ ...validParams, user: '   ' }),
      ).toThrow(InvalidLaunchRequestError);
    });

    it('rejects empty token', () => {
      expect(
        () => new LaunchRequest({ ...validParams, token: '' }),
      ).toThrow(InvalidLaunchRequestError);
    });

    it('rejects invalid currency (not 3 chars)', () => {
      expect(
        () => new LaunchRequest({ ...validParams, currency: 'EU' }),
      ).toThrow(InvalidLaunchRequestError);
    });

    it('rejects missing operatorId', () => {
      expect(
        () => new LaunchRequest({ ...validParams, operatorId: '' }),
      ).toThrow(InvalidLaunchRequestError);
    });

    it('rejects missing gameCode', () => {
      expect(
        () => new LaunchRequest({ ...validParams, gameCode: '' }),
      ).toThrow(InvalidLaunchRequestError);
    });

    it('rejects missing lobbyUrl', () => {
      expect(
        () => new LaunchRequest({ ...validParams, lobbyUrl: '' }),
      ).toThrow(InvalidLaunchRequestError);
    });
  });

  describe('toJSON', () => {
    it('redacts token', () => {
      const request = new LaunchRequest(validParams);
      const json = request.toJSON();
      expect(json.token).toBe('[REDACTED]');
      expect(json.user).toBe('player-abc-123');
      expect(json.currency).toBe('EUR');
    });

    it('redacts token in JSON.stringify', () => {
      const request = new LaunchRequest(validParams);
      const serialized = JSON.stringify(request);
      expect(serialized).toContain('[REDACTED]');
      expect(serialized).not.toContain('f562a685-a160-4d17-876d-ab3363db331c');
    });
  });
});
