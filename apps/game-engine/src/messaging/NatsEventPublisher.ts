import { Injectable, Inject } from '@nestjs/common';
import { NatsConnection } from 'nats';
import { EventPublisher } from '@engine/application/ports/EventPublisher';
import { BetSnapshot } from '@shared/kernel/BetSnapshot';
import { GameEvent } from '@engine/application/GameEvent';
import { Logger } from '@shared/ports/Logger';
import { GameTopics } from './topics';

export const NATS_CONNECTION = 'NATS_CONNECTION';
export const NATS_TOPICS = 'NATS_TOPICS';
export const LOGGER = 'LOGGER';

@Injectable()
export class NatsEventPublisher implements EventPublisher {
  private readonly encoder = new TextEncoder();

  constructor(
    @Inject(NATS_CONNECTION) private readonly nats: NatsConnection,
    @Inject(NATS_TOPICS) private readonly topics: GameTopics,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  async roundNew(roundId: string, hashedSeed: string): Promise<void> {
    this.safePublish(this.topics.ROUND_NEW, { roundId, hashedSeed });
  }

  async roundBetting(roundId: string, endsAt: number): Promise<void> {
    this.safePublish(this.topics.ROUND_BETTING, { roundId, endsAt });
  }

  async roundStarted(roundId: string): Promise<void> {
    this.safePublish(this.topics.ROUND_STARTED, { roundId });
  }

  async roundCrashed(
    roundId: string,
    crashPoint: number,
    serverSeed: string,
  ): Promise<void> {
    this.safePublish(this.topics.ROUND_CRASHED, {
      roundId,
      crashPoint,
      serverSeed,
    });
  }

  async tick(
    roundId: string,
    multiplier: number,
    elapsed: number,
  ): Promise<void> {
    this.safePublish(this.topics.TICK, { roundId, multiplier, elapsedMs: elapsed });
  }

  async betPlaced(bet: BetSnapshot): Promise<void> {
    this.safePublish(this.topics.BET_PLACED, bet);
  }

  async betWon(bet: BetSnapshot): Promise<void> {
    this.safePublish(this.topics.BET_WON, bet);
  }

  async betLost(bet: BetSnapshot, crashPoint: number): Promise<void> {
    this.safePublish(this.topics.BET_LOST, { ...bet, crashPoint });
  }

  async betRejected(
    playerId: string,
    roundId: string,
    amountCents: number,
    error: string,
  ): Promise<void> {
    this.safePublish(this.topics.BET_REJECTED, {
      playerId,
      roundId,
      amountCents,
      error,
    });
  }

  async creditFailed(
    playerId: string,
    betId: string,
    roundId: string,
    payoutCents: number,
    reason: string,
  ): Promise<void> {
    this.safePublish(this.topics.CREDIT_FAILED, {
      playerId,
      betId,
      roundId,
      payoutCents,
      reason,
    });
  }

  async publishBatch(events: GameEvent[]): Promise<void> {
    // Synchronous copy before any await — the events array is owned by
    // TickEventBuffer's double-buffer pool and will be recycled on the
    // next swap() call.
    const copied = new Array<GameEvent>(events.length);
    for (let i = 0; i < events.length; i++) {
      copied[i] = events[i];
    }

    for (let i = 0; i < copied.length; i++) {
      const event = copied[i];
      switch (event.type) {
        case 'tick':
          this.safePublish(this.topics.TICK, {
            roundId: event.roundId,
            multiplier: event.multiplier,
            elapsedMs: event.elapsedMs,
          });
          break;
        case 'bet_won':
          this.safePublish(this.topics.BET_WON, event.snapshot);
          break;
        case 'bet_lost':
          this.safePublish(this.topics.BET_LOST, {
            ...event.snapshot,
            crashPoint: event.multiplier,
          });
          break;
        case 'round_crashed':
          this.safePublish(this.topics.ROUND_CRASHED, {
            roundId: event.roundId,
            crashPoint: event.multiplier,
            serverSeed: event.serverSeed,
          });
          break;
      }
    }
  }

  /**
   * Publishes a JSON payload to the given NATS subject.
   * Catches and logs any error without re-throwing —
   * the engine must never crash due to a publish failure.
   */
  private safePublish(subject: string, payload: unknown): void {
    try {
      this.nats.publish(subject, this.encoder.encode(JSON.stringify(payload)));
    } catch (err) {
      this.logger.error('NATS publish failed', {
        subject,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
