import { randomUUID } from 'crypto';
import { LaunchRequest } from '../domain/LaunchRequest';
import { PlayerSession } from '../domain/PlayerSession';
import { SessionStore } from './ports/SessionStore';
import { PlayerRepository } from './ports/PlayerRepository';
import { SessionRepository } from './ports/SessionRepository';
import { TokenIssuer } from './ports/TokenIssuer';
import { LaunchGameCommand } from './commands/LaunchGameCommand';
import { LaunchGameResult } from './commands/LaunchGameResult';

export class LaunchGameUseCase {
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly playerRepo: PlayerRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly tokenIssuer: TokenIssuer,
    private readonly gameClientUrl: string,
    private readonly sessionTtlSeconds: number,
  ) {}

  async execute(command: LaunchGameCommand): Promise<LaunchGameResult> {
    const request = new LaunchRequest({
      user: command.user,
      token: command.token,
      currency: command.currency,
      operatorId: command.operatorId,
      gameCode: command.gameCode,
      platform: command.platform,
      lang: command.lang,
      lobbyUrl: command.lobbyUrl,
      depositUrl: command.depositUrl,
      country: command.country,
      ip: command.ip,
    });

    const player = await this.playerRepo.upsert({
      operatorId: command.operatorId,
      operatorPlayerId: request.user,
      currency: request.currency,
      country: command.country ?? null,
      language: request.lang,
    });

    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + this.sessionTtlSeconds * 1000);

    const session = new PlayerSession(
      sessionId,
      player.id,
      command.operatorId,
      request.user,
      request.token,
      request.currency,
      request.platform,
      expiresAt,
    );

    await this.sessionStore.save(session, this.sessionTtlSeconds);
    try {
      await this.sessionRepo.save({
        id: sessionId,
        playerId: player.id,
        operatorToken: request.token,
        platform: request.platform,
        ipAddress: command.ip ?? null,
        expiresAt,
      });
    } catch (e) {
      await this.sessionStore.delete(session.sessionId).catch(() => {});
      throw e;
    }

    const accessToken = this.tokenIssuer.createAccessToken({
      sub: player.id,
      operatorId: command.operatorId,
      operatorPlayerId: request.user,
      currency: request.currency,
      sessionId,
    });

    const url = `${this.gameClientUrl}/game?token=${encodeURIComponent(request.token)}&lang=${request.lang}`;

    return { success: true, url, token: accessToken };
  }
}
