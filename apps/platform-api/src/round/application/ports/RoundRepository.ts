import { RoundRecord } from '../../domain/RoundRecord';

export interface RoundRepository {
  save(round: RoundRecord): Promise<RoundRecord>;
  updateStatus(round: RoundRecord): Promise<RoundRecord | null>;
  recordCrashPoint(roundId: string, crashPoint: string): Promise<void>;
  findById(roundId: string): Promise<RoundRecord | null>;
  findCurrentByOperatorId(operatorId: string): Promise<RoundRecord | null>;
}
