import { LaunchGameUseCase } from '../LaunchGameUseCase';
import { SessionStore } from '../ports/SessionStore';
import { PlayerRepository } from '../ports/PlayerRepository';
import { SessionRepository } from '../ports/SessionRepository';
import { TokenIssuer } from '../ports/TokenIssuer';
import { LaunchGameCommand } from '../commands/LaunchGameCommand';
import { InvalidLaunchRequestError } from '@shared/kernel/DomainError';

describe('LaunchGameUseCase', () => {
  let sessionStore: jest.Mocked<SessionStore>;
  let playerRepo: jest.Mocked<PlayerRepository>;
  let sessionRepo: jest.Mocked<SessionRepository>;
  let tokenIssuer: jest.Mocked<TokenIssuer>;
  let useCase: LaunchGameUseCase;

  const GAME_CLIENT_URL = 'https://play.aviatrix.bet';
  const SESSION_TTL = 1800;

  beforeEach(() => {
    sessionStore = {
      save: jest.fn(),
      delete: jest.fn(),
      getByOperatorToken: jest.fn(),
      refreshTtl: jest.fn(),
      getOperatorToken: jest.fn(),
    };
    playerRepo = {
      upsert: jest.fn().mockResolvedValue({ id: 'player-uuid-1' }),
    };
    sessionRepo = {
      save: jest.fn(),
    };
    tokenIssuer = {
      createAccessToken: jest.fn().mockReturnValue('access-jwt-123'),
      createRefreshToken: jest.fn().mockReturnValue('refresh-jwt-456'),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    };

    useCase = new LaunchGameUseCase(
      sessionStore,
      playerRepo,
      sessionRepo,
      tokenIssuer,
      GAME_CLIENT_URL,
      SESSION_TTL,
    );
  });

  const makeCommand = (overrides?: Partial<LaunchGameCommand>): LaunchGameCommand => ({
    user: 'player-abc',
    token: 'op-token-xyz',
    currency: 'EUR',
    operatorId: 'op-1',
    gameCode: 'aviatrix_crash',
    platform: 'GPL_DESKTOP',
    lang: 'en',
    lobbyUrl: 'https://megacasino.com',
    ...overrides,
  });

  it('returns success with URL and access token', async () => {
    const result = await useCase.execute(makeCommand());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.url).toContain(GAME_CLIENT_URL);
      expect(result.url).toContain('token=op-token-xyz');
      expect(result.url).toContain('lang=en');
      expect(result.token).toBe('access-jwt-123');
    }
  });

  it('upserts player with correct data', async () => {
    await useCase.execute(makeCommand({ country: 'EE' }));

    expect(playerRepo.upsert).toHaveBeenCalledWith({
      operatorId: 'op-1',
      operatorPlayerId: 'player-abc',
      currency: 'EUR',
      country: 'EE',
      language: 'en',
    });
  });

  it('saves session to Redis store', async () => {
    await useCase.execute(makeCommand());

    expect(sessionStore.save).toHaveBeenCalledTimes(1);
    const [session, ttl] = sessionStore.save.mock.calls[0];
    expect(session.playerId).toBe('player-uuid-1');
    expect(session.operatorId).toBe('op-1');
    expect(session.operatorToken).toBe('op-token-xyz');
    expect(session.currency).toBe('EUR');
    expect(ttl).toBe(SESSION_TTL);
  });

  it('saves session audit to PostgreSQL repository', async () => {
    await useCase.execute(makeCommand({ ip: '10.0.0.1' }));

    expect(sessionRepo.save).toHaveBeenCalledTimes(1);
    const [data] = sessionRepo.save.mock.calls[0];
    expect(data.playerId).toBe('player-uuid-1');
    expect(data.operatorToken).toBe('op-token-xyz');
    expect(data.ipAddress).toBe('10.0.0.1');
    expect(data.platform).toBe('GPL_DESKTOP');
  });

  it('creates access token with correct payload', async () => {
    await useCase.execute(makeCommand());

    expect(tokenIssuer.createAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'player-uuid-1',
        operatorId: 'op-1',
        operatorPlayerId: 'player-abc',
        currency: 'EUR',
      }),
    );
  });

  it('encodes operator token in URL', async () => {
    const result = await useCase.execute(makeCommand({ token: 'token with spaces' }));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.url).toContain('token=token%20with%20spaces');
    }
  });

  it('throws InvalidLaunchRequestError for demo mode (XXX currency)', async () => {
    await expect(useCase.execute(makeCommand({ currency: 'XXX' }))).rejects.toThrow(
      InvalidLaunchRequestError,
    );
  });

  it('throws InvalidLaunchRequestError for missing user', async () => {
    await expect(useCase.execute(makeCommand({ user: '' }))).rejects.toThrow(
      InvalidLaunchRequestError,
    );
  });

  it('throws InvalidLaunchRequestError for missing token', async () => {
    await expect(useCase.execute(makeCommand({ token: '' }))).rejects.toThrow(
      InvalidLaunchRequestError,
    );
  });

  it('passes null ipAddress when ip not provided', async () => {
    await useCase.execute(makeCommand());

    const [data] = sessionRepo.save.mock.calls[0];
    expect(data.ipAddress).toBeNull();
  });
});
