import { SessionStore } from './ports/SessionStore';
import { TokenIssuer } from './ports/TokenIssuer';
import { ExchangeTokenCommand } from './commands/ExchangeTokenCommand';
import { ExchangeTokenResult } from './commands/ExchangeTokenResult';

export class ExchangeTokenUseCase {
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly tokenIssuer: TokenIssuer,
    private readonly sessionTtlSeconds: number,
  ) {}

  async execute(command: ExchangeTokenCommand): Promise<ExchangeTokenResult> {
    const session = await this.sessionStore.getByOperatorToken(command.operatorToken);
    if (!session) {
      return { success: false, error: 'SESSION_NOT_FOUND' };
    }

    if (session.isExpired()) {
      return { success: false, error: 'SESSION_EXPIRED' };
    }

    await this.sessionStore.refreshTtl(session, this.sessionTtlSeconds);

    const payload = {
      sub: session.playerId,
      operatorId: session.operatorId,
      operatorPlayerId: session.operatorPlayerId,
      currency: session.currency,
      sessionId: session.sessionId,
    };

    return {
      success: true,
      accessToken: this.tokenIssuer.createAccessToken(payload),
      refreshToken: this.tokenIssuer.createRefreshToken(payload),
    };
  }
}
