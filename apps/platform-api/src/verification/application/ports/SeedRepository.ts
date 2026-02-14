import { SeedData } from '@shared/types/SeedData';

export interface SeedRepository {
  findByRoundId(roundId: string): Promise<SeedData | null>;
}
