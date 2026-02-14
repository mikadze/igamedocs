import { VerificationData } from '../commands/GetVerificationDataResult';

export interface VerificationCache {
  get(roundId: string): Promise<VerificationData | null>;
  set(roundId: string, data: VerificationData, ttlSeconds: number): Promise<void>;
}
