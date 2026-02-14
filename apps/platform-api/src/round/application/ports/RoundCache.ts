import { RoundRecord } from '../../domain/RoundRecord';

export interface RoundCache {
  getCurrentRound(operatorId: string): Promise<RoundRecord | null>;
  setCurrentRound(operatorId: string, round: RoundRecord): Promise<void>;
  clearCurrentRound(operatorId: string): Promise<void>;
  cacheSettledRound(round: RoundRecord, ttlSeconds: number): Promise<void>;
  getById(roundId: string): Promise<RoundRecord | null>;
}
