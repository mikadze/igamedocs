import { Round } from '@engine/domain/Round';
import { RoundState } from '@engine/domain/RoundState';
import { BetSnapshot, toBetSnapshot } from '@engine/application/ports/EventPublisher';

export interface RoundSnapshot {
  roundId: string;
  state: RoundState;
  currentMultiplier: number;
  hashedSeed: string;
  bets: BetSnapshot[];
}

export class GetRoundStateUseCase {
  private currentRound: Round | null = null;

  setCurrentRound(round: Round | null): void {
    this.currentRound = round;
  }

  execute(): RoundSnapshot | null {
    if (!this.currentRound) {
      return null;
    }

    return {
      roundId: this.currentRound.id,
      state: this.currentRound.state,
      currentMultiplier: this.currentRound.currentMultiplier,
      hashedSeed: this.currentRound.hashedSeed,
      bets: this.currentRound.bets.getAll().map(toBetSnapshot),
    };
  }
}
