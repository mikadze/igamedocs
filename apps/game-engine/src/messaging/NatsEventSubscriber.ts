import { Injectable, Inject } from '@nestjs/common';
import { NatsConnection, Subscription } from 'nats';
import { z } from 'zod';
import { EventSubscriber } from '@engine/application/ports/EventSubscriber';
import { PlaceBetCommand } from '@betting/application/commands/PlaceBetCommand';
import { CashoutCommand } from '@betting/application/commands/CashoutCommand';
import { Logger } from '@shared/ports/Logger';
import { GameTopics } from './topics';
import { NATS_CONNECTION, NATS_TOPICS, LOGGER } from './NatsEventPublisher';

/**
 * Zod schemas for inbound NATS command payloads.
 * These form the anti-corruption layer: any malformed or
 * malicious JSON is rejected before reaching the game loop.
 */
const placeBetSchema = z.object({
  playerId: z.string().min(1),
  roundId: z.string().min(1),
  amountCents: z.number().int().positive(),
  autoCashout: z.number().positive().optional(),
});

const cashoutSchema = z.object({
  playerId: z.string().min(1),
  roundId: z.string().min(1),
  betId: z.string().min(1),
});

@Injectable()
export class NatsEventSubscriber implements EventSubscriber {
  private readonly subscriptions: Subscription[] = [];

  constructor(
    @Inject(NATS_CONNECTION) private readonly nats: NatsConnection,
    @Inject(NATS_TOPICS) private readonly topics: GameTopics,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  onPlaceBet(handler: (cmd: PlaceBetCommand) => void): void {
    this.safeSubscribe(this.topics.CMD_PLACE_BET, placeBetSchema, handler);
  }

  onCashout(handler: (cmd: CashoutCommand) => void): void {
    this.safeSubscribe(this.topics.CMD_CASHOUT, cashoutSchema, handler);
  }

  async close(): Promise<void> {
    await Promise.all(this.subscriptions.map((s) => s.drain()));
    this.subscriptions.length = 0;
  }

  private safeSubscribe<T>(subject: string, schema: z.ZodType<T>, handler: (cmd: T) => void): void {
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
            this.logger.error('Invalid NATS command payload', {
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
            error: parseErr instanceof Error ? parseErr.message : String(parseErr),
          });
        }
      },
    });
    this.subscriptions.push(sub);
  }
}
