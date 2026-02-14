import { RefreshTokenUseCase } from '../RefreshTokenUseCase';
import { TokenIssuer } from '../ports/TokenIssuer';
import { TokenPayload } from '@shared/types/TokenPayload';

describe('RefreshTokenUseCase', () => {
  let tokenIssuer: jest.Mocked<TokenIssuer>;
  let useCase: RefreshTokenUseCase;

  const validPayload: TokenPayload = {
    sub: 'player-1',
    operatorId: 'op-1',
    operatorPlayerId: 'op-player-1',
    currency: 'EUR',
    sessionId: 'session-1',
    type: 'refresh',
  };

  beforeEach(() => {
    tokenIssuer = {
      createAccessToken: jest.fn().mockReturnValue('new-access-jwt'),
      createRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn().mockReturnValue(validPayload),
    };

    useCase = new RefreshTokenUseCase(tokenIssuer);
  });

  it('returns new access token for valid refresh token', () => {
    const result = useCase.execute({ refreshToken: 'valid-refresh-jwt' });

    expect(result).toEqual({ success: true, accessToken: 'new-access-jwt' });
  });

  it('verifies the refresh token', () => {
    useCase.execute({ refreshToken: 'the-refresh-token' });

    expect(tokenIssuer.verifyRefreshToken).toHaveBeenCalledWith('the-refresh-token');
  });

  it('creates access token from verified payload', () => {
    useCase.execute({ refreshToken: 'valid-refresh-jwt' });

    expect(tokenIssuer.createAccessToken).toHaveBeenCalledWith(validPayload);
  });

  it('returns INVALID_REFRESH_TOKEN when verification fails', () => {
    tokenIssuer.verifyRefreshToken.mockImplementation(() => {
      throw new Error('Token expired');
    });

    const result = useCase.execute({ refreshToken: 'expired-token' });

    expect(result).toEqual({ success: false, error: 'INVALID_REFRESH_TOKEN' });
  });

  it('is synchronous (no async)', () => {
    const result = useCase.execute({ refreshToken: 'valid' });

    // Result is not a Promise
    expect(result).not.toBeInstanceOf(Promise);
  });
});
