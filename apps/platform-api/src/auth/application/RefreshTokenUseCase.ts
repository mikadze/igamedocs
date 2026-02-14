import { TokenIssuer } from './ports/TokenIssuer';
import { RefreshTokenCommand } from './commands/RefreshTokenCommand';
import { RefreshTokenResult } from './commands/RefreshTokenResult';

export class RefreshTokenUseCase {
  constructor(private readonly tokenIssuer: TokenIssuer) {}

  execute(command: RefreshTokenCommand): RefreshTokenResult {
    try {
      const payload = this.tokenIssuer.verifyRefreshToken(command.refreshToken);
      const newAccessToken = this.tokenIssuer.createAccessToken(payload);
      return { success: true, accessToken: newAccessToken };
    } catch (e) {
      if (e instanceof Error) {
        return { success: false, error: 'INVALID_REFRESH_TOKEN' };
      }
      throw e;
    }
  }
}
