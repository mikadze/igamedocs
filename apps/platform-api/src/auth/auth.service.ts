import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { DbService } from '../db/db.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { TokenService, JwtPayload } from '../crypto/token.service';
import { players, playerSessions } from '../db/schema';
import { GameLaunchDto } from './dto/game-launch.dto';

const SESSION_TTL_SECONDS = 30 * 60; // 30 minutes

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: DbService,
    private readonly tokenService: TokenService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Handle game launch from aggregator/operator.
   * Creates or finds the player, creates a session, returns game URL.
   */
  async handleGameLaunch(
    dto: GameLaunchDto,
    operator: { id: string; code: string },
  ): Promise<{ url: string; token: string }> {
    // Upsert player
    const player = await this.upsertPlayer({
      operatorId: operator.id,
      operatorPlayerId: dto.user,
      currency: dto.currency,
      country: dto.country ?? null,
      language: dto.lang,
    });

    // Create session
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    const jwtPayload: JwtPayload = {
      sub: player.id,
      operatorId: operator.id,
      operatorPlayerId: dto.user,
      currency: dto.currency,
      sessionId,
    };

    const accessToken = this.tokenService.createAccessToken(jwtPayload);

    // Store session in Redis (primary) with TTL
    const sessionData = JSON.stringify({
      playerId: player.id,
      operatorId: operator.id,
      operatorPlayerId: dto.user,
      operatorToken: dto.token,
      currency: dto.currency,
      platform: dto.platform,
      lobbyUrl: dto.lobby_url,
      depositUrl: dto.deposit_url,
      country: dto.country,
      language: dto.lang,
      sessionId,
    });
    // Set both session keys atomically with same TTL
    const pipeline = this.redis.pipeline();
    pipeline.setex(`session:${dto.token}`, SESSION_TTL_SECONDS, sessionData);
    pipeline.setex(
      `session:token:${operator.id}:${player.id}`,
      SESSION_TTL_SECONDS,
      dto.token,
    );
    await pipeline.exec();

    // Store session in PostgreSQL (backup/audit)
    await this.db.drizzle.insert(playerSessions).values({
      id: sessionId,
      playerId: player.id,
      operatorToken: dto.token,
      platform: dto.platform,
      ipAddress: dto.ip ?? null,
      expiresAt,
    });

    // Build game URL
    const baseUrl =
      process.env.GAME_CLIENT_URL ?? 'https://play.aviatrix.bet';
    const url = `${baseUrl}/game?token=${encodeURIComponent(dto.token)}&lang=${dto.lang}`;

    this.logger.log(
      `Game launched for player ${dto.user} on operator ${operator.code}`,
    );

    return { url, token: accessToken };
  }

  /**
   * Exchange an operator token for an internal JWT.
   * Called by the game client after loading in iFrame.
   */
  async exchangeToken(
    operatorToken: string,
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    const sessionJson = await this.redis.get(`session:${operatorToken}`);
    if (!sessionJson) return null;

    const session = JSON.parse(sessionJson);

    const jwtPayload: JwtPayload = {
      sub: session.playerId,
      operatorId: session.operatorId,
      operatorPlayerId: session.operatorPlayerId,
      currency: session.currency,
      sessionId: session.sessionId,
    };

    // Refresh session TTL on activity
    await this.redis.expire(`session:${operatorToken}`, SESSION_TTL_SECONDS);
    await this.redis.expire(
      `session:token:${session.operatorId}:${session.playerId}`,
      SESSION_TTL_SECONDS,
    );

    return {
      accessToken: this.tokenService.createAccessToken(jwtPayload),
      refreshToken: this.tokenService.createRefreshToken(jwtPayload),
    };
  }

  /**
   * Refresh an expired access token using a valid refresh token.
   */
  refreshAccessToken(
    refreshToken: string,
  ): { accessToken: string } | null {
    try {
      const payload = this.tokenService.verifyRefreshToken(refreshToken);
      const newAccess = this.tokenService.createAccessToken(payload);
      return { accessToken: newAccess };
    } catch {
      return null;
    }
  }

  /**
   * Get session info for authenticated player.
   */
  async getSession(payload: JwtPayload) {
    return {
      playerId: payload.sub,
      operatorId: payload.operatorId,
      operatorPlayerId: payload.operatorPlayerId,
      currency: payload.currency,
      sessionId: payload.sessionId,
    };
  }

  private async upsertPlayer(data: {
    operatorId: string;
    operatorPlayerId: string;
    currency: string;
    country: string | null;
    language: string;
  }) {
    const now = new Date();

    // Atomic upsert — no race condition on concurrent game launches
    const [player] = await this.db.drizzle
      .insert(players)
      .values({
        operatorId: data.operatorId,
        operatorPlayerId: data.operatorPlayerId,
        currency: data.currency,
        country: data.country,
        language: data.language,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: [players.operatorId, players.operatorPlayerId],
        set: {
          currency: data.currency,
          country: data.country,
          language: data.language,
          lastSeenAt: now,
          updatedAt: now,
        },
      })
      .returning();

    return player;
  }
}
