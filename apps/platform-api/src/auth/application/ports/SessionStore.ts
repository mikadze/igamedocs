import { PlayerSession } from '../../domain/PlayerSession';

export interface SessionStore {
  save(session: PlayerSession, ttlSeconds: number): Promise<void>;
  delete(sessionId: string): Promise<void>;
  getByOperatorToken(token: string): Promise<PlayerSession | null>;
  refreshTtl(session: PlayerSession, ttlSeconds: number): Promise<void>;
  getOperatorToken(operatorId: string, playerId: string): Promise<string | null>;
}
