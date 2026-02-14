import { importSPKI, jwtVerify } from 'jose';
import type { AuthGateway, AuthPayload } from '@connection/application/ports/AuthGateway';

export class JwtAuthGateway implements AuthGateway {
  private keyPromise: Promise<CryptoKey>;

  constructor(pemPublicKey: string) {
    this.keyPromise = importSPKI(pemPublicKey, 'RS256');
  }

  async verify(token: string): Promise<AuthPayload | null> {
    try {
      const key = await this.keyPromise;
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['RS256'],
      });

      const playerId = payload.playerId ?? payload.sub;
      const operatorId = payload.operatorId;

      if (typeof playerId !== 'string' || typeof operatorId !== 'string') {
        return null;
      }

      return { playerId, operatorId };
    } catch {
      return null;
    }
  }
}
