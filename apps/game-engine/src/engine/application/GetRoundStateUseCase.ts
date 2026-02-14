import { RoundState } from '@engine/domain/RoundState';
import { BetSnapshot } from '@shared/kernel/BetSnapshot';
import { toBetSnapshot } from '@engine/application/mappers/toBetSnapshot';
import { CurrentRoundStore } from '@engine/application/ports/CurrentRoundStore';

export interface RoundSnapshot {
  roundId: string;
  state: RoundState;
  currentMultiplier: number;
  hashedSeed: string;
  bets: BetSnapshot[];
}

export class GetRoundStateUseCase {
  constructor(private readonly currentRoundStore: CurrentRoundStore) {}

  execute(): RoundSnapshot | null {
    const currentRound = this.currentRoundStore.get();
    if (!currentRound) {
      return null;
    }

    return {
      roundId: currentRound.id,
      state: currentRound.state,
      currentMultiplier: currentRound.currentMultiplier,
      hashedSeed: currentRound.hashedSeed,
      bets: currentRound.bets.getAll().map(toBetSnapshot),
    };
  }
}
