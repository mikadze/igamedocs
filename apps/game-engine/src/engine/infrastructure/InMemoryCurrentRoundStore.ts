import { Round } from '@engine/domain/Round';
import { CurrentRoundStore } from '@engine/application/ports/CurrentRoundStore';

export class InMemoryCurrentRoundStore implements CurrentRoundStore {
  private currentRound: Round | null = null;

  get(): Round | null {
    return this.currentRound;
  }

  set(round: Round | null): void {
    this.currentRound = round;
  }
}
