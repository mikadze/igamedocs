import { RoundSummary } from '@shared/types/RoundSummary';

export interface RoundLookupPort {
  findById(roundId: string): Promise<RoundSummary | null>;
}
