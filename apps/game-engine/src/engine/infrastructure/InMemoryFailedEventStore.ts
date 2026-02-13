import { GameEvent } from '@engine/application/GameEvent';
import { FailedEventStore } from '@engine/application/ports/FailedEventStore';

export class InMemoryFailedEventStore implements FailedEventStore {
  private readonly batches: GameEvent[][] = [];

  addBatch(events: GameEvent[]): void {
    this.batches.push([...events]);
  }
}
