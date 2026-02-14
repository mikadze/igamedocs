import { ExchangeTokenUseCase } from '../ExchangeTokenUseCase';
import { SessionStore } from '../ports/SessionStore';
import { TokenIssuer } from '../ports/TokenIssuer';
import { PlayerSession } from '../../domain/PlayerSession';

describe('ExchangeTokenUseCase', () => {
  let sessionStore: jest.Mocked<SessionStore>;
  let tokenIssuer: jest.Mocked<TokenIssuer>;
  let useCase: ExchangeTokenUseCase;

  const SESSION_TTL = 1800;

  const makeSession = () => {
    const future = new Date(Date.now() + 60_000);
    return new PlayerSession(
      'session-1',
      'player-1',
      'op-1',
      'op-player-1',
      'op-token-abc',
      'EUR',
      'GPL_DESKTOP',
      future,
    );
  };

  beforeEach(() => {
    sessionStore = {
      save: jest.fn(),
      delete: jest.fn(),
      getByOperatorToken: jest.fn(),
      refreshTtl: jest.fn(),
      getOperatorToken: jest.fn(),
    };
    tokenIssuer = {
      createAccessToken: jest.fn().mockReturnValue('new-access-jwt'),
      createRefreshToken: jest.fn().mockReturnValue('new-refresh-jwt'),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    };

    useCase = new ExchangeTokenUseCase(sessionStore, tokenIssuer, SESSION_TTL);
  });

  it('returns access and refresh tokens on valid session', async () => {
    const session = makeSession();
    sessionStore.getByOperatorToken.mockResolvedValue(session);

    const result = await useCase.execute({ operatorToken: 'op-token-abc' });

    expect(result).toEqual({
      success: true,
      accessToken: 'new-access-jwt',
      refreshToken: 'new-refresh-jwt',
    });
  });

  it('returns SESSION_NOT_FOUND when session does not exist', async () => {
    sessionStore.getByOperatorToken.mockResolvedValue(null);

    const result = await useCase.execute({ operatorToken: 'invalid-token' });

    expect(result).toEqual({ success: false, error: 'SESSION_NOT_FOUND' });
  });

  it('returns SESSION_EXPIRED when session is expired', async () => {
    const past = new Date(Date.now() - 60_000);
    const expiredSession = new PlayerSession(
      'session-1',
      'player-1',
      'op-1',
      'op-player-1',
      'op-token-abc',
      'EUR',
      'GPL_DESKTOP',
      past,
    );
    sessionStore.getByOperatorToken.mockResolvedValue(expiredSession);

    const result = await useCase.execute({ operatorToken: 'op-token-abc' });

    expect(result).toEqual({ success: false, error: 'SESSION_EXPIRED' });
  });

  it('refreshes session TTL on successful exchange', async () => {
    const session = makeSession();
    sessionStore.getByOperatorToken.mockResolvedValue(session);

    await useCase.execute({ operatorToken: 'op-token-abc' });

    expect(sessionStore.refreshTtl).toHaveBeenCalledWith(session, SESSION_TTL);
  });

  it('creates tokens with correct payload fields', async () => {
    const session = makeSession();
    sessionStore.getByOperatorToken.mockResolvedValue(session);

    await useCase.execute({ operatorToken: 'op-token-abc' });

    const expectedPayload = {
      sub: 'player-1',
      operatorId: 'op-1',
      operatorPlayerId: 'op-player-1',
      currency: 'EUR',
      sessionId: 'session-1',
    };
    expect(tokenIssuer.createAccessToken).toHaveBeenCalledWith(expectedPayload);
    expect(tokenIssuer.createRefreshToken).toHaveBeenCalledWith(expectedPayload);
  });

  it('does not refresh TTL when session not found', async () => {
    sessionStore.getByOperatorToken.mockResolvedValue(null);

    await useCase.execute({ operatorToken: 'invalid' });

    expect(sessionStore.refreshTtl).not.toHaveBeenCalled();
  });
});
