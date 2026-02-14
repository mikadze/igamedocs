import { TokenPayload } from '@shared/types/TokenPayload';

export interface TokenIssuer {
  createAccessToken(payload: TokenPayload): string;
  createRefreshToken(payload: TokenPayload): string;
  verifyAccessToken(token: string): TokenPayload;
  verifyRefreshToken(token: string): TokenPayload;
}
