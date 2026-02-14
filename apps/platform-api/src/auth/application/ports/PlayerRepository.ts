export interface PlayerRepository {
  upsert(data: {
    operatorId: string;
    operatorPlayerId: string;
    currency: string;
    country?: string | null;
    language: string;
  }): Promise<{ id: string }>;
}
