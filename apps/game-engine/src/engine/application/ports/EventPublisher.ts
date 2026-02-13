import { BetSnapshot } from '@shared/kernel/BetSnapshot';
import { GameEvent } from '@engine/application/GameEvent';

export type { BetSnapshot };

export interface EventPublisher {
  roundNew(roundId: string, hashedSeed: string): Promise<void>;
  roundBetting(roundId: string, endsAt: number): Promise<void>;
  roundStarted(roundId: string): Promise<void>;
  roundCrashed(
    roundId: string,
    crashPoint: number,
    serverSeed: string,
  ): Promise<void>;
  tick(roundId: string, multiplier: number, elapsed: number): Promise<void>;
  betPlaced(bet: BetSnapshot): Promise<void>;
  betWon(bet: BetSnapshot): Promise<void>;
  betLost(bet: BetSnapshot, crashPoint: number): Promise<void>;
  betRejected(
    playerId: string,
    roundId: string,
    amountCents: number,
    error: string,
  ): Promise<void>;
  creditFailed(
    playerId: string,
    betId: string,
    roundId: string,
    payoutCents: number,
    reason: string,
  ): Promise<void>;
  /**
   * Publish a batch of tick-produced events.
   *
   * **Contract:** The `events` array is owned by a double-buffer pool
   * (`TickEventBuffer`) and will be recycled on the next flush cycle.
   * Implementations must synchronously read or copy all elements
   * before their first `await` — any deferred access will see a
   * cleared array.
   */
  publishBatch(events: GameEvent[]): Promise<void>;
}
