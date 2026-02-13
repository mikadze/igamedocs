import { GameEvent } from '@engine/application/GameEvent';

export interface FailedEventStore {
  addBatch(events: GameEvent[]): void;
}
