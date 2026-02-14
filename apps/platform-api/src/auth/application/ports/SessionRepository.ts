export interface SessionRepository {
  save(data: {
    id: string;
    playerId: string;
    operatorToken: string;
    platform: string;
    ipAddress: string | null;
    expiresAt: Date;
  }): Promise<void>;
}
