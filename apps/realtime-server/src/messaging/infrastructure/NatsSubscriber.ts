import type { NatsConnection, Subscription } from 'nats';
import type { z } from 'zod';
import type { MessageBrokerSubscriber } from '@messaging/application/ports/MessageBrokerSubscriber';
import type { GameTopics } from '@messaging/infrastructure/topics';
import type { Logger } from '@shared/ports/Logger';
import {
  roundNewSchema,
  roundBettingSchema,
  roundStartedSchema,
  roundCrashedSchema,
  tickSchema,
  betPlacedSchema,
  betWonSchema,
  betLostSchema,
  betRejectedSchema,
  creditFailedSchema,
} from './nats-schemas';

export class NatsSubscriber implements MessageBrokerSubscriber {
  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly nats: NatsConnection,
    private readonly topics: GameTopics,
    private readonly logger: Logger,
  ) {}

  onRoundNew(handler: (data: { roundId: string; hashedSeed: string }) => void): void {
    this.safeSubscribe(this.topics.ROUND_NEW, roundNewSchema, handler);
  }

  onRoundBetting(handler: (data: { roundId: string; endsAt: number }) => void): void {
    this.safeSubscribe(this.topics.ROUND_BETTING, roundBettingSchema, handler);
  }

  onRoundStarted(handler: (data: { roundId: string }) => void): void {
    this.safeSubscribe(this.topics.ROUND_STARTED, roundStartedSchema, handler);
  }

  onRoundCrashed(handler: (data: { roundId: string; crashPoint: number; serverSeed: string }) => void): void {
    this.safeSubscribe(this.topics.ROUND_CRASHED, roundCrashedSchema, handler);
  }

  onTick(handler: (data: { roundId: string; multiplier: number; elapsedMs: number }) => void): void {
    this.safeSubscribe(this.topics.TICK, tickSchema, handler);
  }

  onBetPlaced(handler: (data: { betId: string; playerId: string; roundId: string; amountCents: number }) => void): void {
    this.safeSubscribe(this.topics.BET_PLACED, betPlacedSchema, handler);
  }

  onBetWon(handler: (data: { betId: string; playerId: string; roundId: string; amountCents: number; cashoutMultiplier: number; payoutCents: number }) => void): void {
    this.safeSubscribe(this.topics.BET_WON, betWonSchema, handler);
  }

  onBetLost(handler: (data: { betId: string; playerId: string; roundId: string; amountCents: number; crashPoint: number }) => void): void {
    this.safeSubscribe(this.topics.BET_LOST, betLostSchema, handler);
  }

  onBetRejected(handler: (data: { playerId: string; roundId: string; amountCents: number; error: string }) => void): void {
    this.safeSubscribe(this.topics.BET_REJECTED, betRejectedSchema, handler);
  }

  onCreditFailed(handler: (data: { playerId: string; betId: string; roundId: string; payoutCents: number; reason: string }) => void): void {
    this.safeSubscribe(this.topics.CREDIT_FAILED, creditFailedSchema, handler);
  }

  async close(): Promise<void> {
    await Promise.all(this.subscriptions.map((s) => s.drain()));
    this.subscriptions.length = 0;
  }

  private safeSubscribe<T>(
    subject: string,
    schema: z.ZodType<T>,
    handler: (data: T) => void,
  ): void {
    const sub = this.nats.subscribe(subject, {
      callback: (err, msg) => {
        if (err) {
          this.logger.error('NATS subscription error', {
            subject,
            error: err.message,
          });
          return;
        }
        try {
          const raw = msg.json();
          const result = schema.safeParse(raw);
          if (!result.success) {
            this.logger.error('Invalid NATS event payload', {
              subject,
              issues: result.error.issues.map((i) => ({
                path: i.path.join('.'),
                message: i.message,
              })),
            });
            return;
          }
          handler(result.data);
        } catch (parseErr) {
          this.logger.error('Failed to process NATS message', {
            subject,
            error:
              parseErr instanceof Error
                ? parseErr.message
                : String(parseErr),
          });
        }
      },
    });
    this.subscriptions.push(sub);
  }
}
