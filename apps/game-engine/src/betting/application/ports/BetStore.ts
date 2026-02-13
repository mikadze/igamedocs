import { Bet } from '@engine/domain/Bet';

export interface BetStore {
  add(bet: Bet): void;
  getById(betId: string): Bet | undefined;
  getByRound(roundId: string): Bet[];
  getActiveByRound(roundId: string): Bet[];
}
