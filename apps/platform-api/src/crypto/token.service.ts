import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSigner, createVerifier } from 'fast-jwt';

export interface JwtPayload {
  sub: string; // player UUID
  operatorId: string;
  operatorPlayerId: string;
  currency: string;
  sessionId: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly sign: (payload: Record<string, unknown>) => string;
  private readonly signRefresh: (payload: Record<string, unknown>) => string;
  private readonly verify: (token: string) => JwtPayload;

  constructor(private readonly config: ConfigService) {
    const isProduction =
      this.config.get<string>('NODE_ENV') === 'production';
    const secret = this.config.get<string>('JWT_SECRET');

    if (!secret && isProduction) {
      throw new Error(
        'JWT_SECRET must be set in production. Refusing to start with default secret.',
      );
    }

    const key = secret ?? 'aviatrix-dev-secret-change-in-production';

    if (!secret) {
      this.logger.warn(
        'JWT_SECRET not set — using dev default. Do NOT use in production.',
      );
    }

    this.sign = createSigner({
      key,
      algorithm: 'HS256',
      expiresIn: 15 * 60 * 1000, // 15 minutes
    });

    this.signRefresh = createSigner({
      key,
      algorithm: 'HS256',
      expiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    this.verify = createVerifier({
      key,
      algorithms: ['HS256'],
    }) as (token: string) => JwtPayload;
  }

  createAccessToken(payload: JwtPayload): string {
    return this.sign(payload as unknown as Record<string, unknown>);
  }

  createRefreshToken(payload: JwtPayload): string {
    return this.signRefresh(payload as unknown as Record<string, unknown>);
  }

  verifyToken(token: string): JwtPayload {
    return this.verify(token);
  }
}
