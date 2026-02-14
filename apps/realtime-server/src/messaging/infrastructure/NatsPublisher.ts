import type { NatsConnection } from 'nats';
import type { MessageBrokerPublisher } from '@messaging/application/ports/MessageBrokerPublisher';
import type { GameTopics } from '@messaging/infrastructure/topics';
import type { Logger } from '@shared/ports/Logger';

export class NatsPublisher implements MessageBrokerPublisher {
  private readonly encoder = new TextEncoder();

  constructor(
    private readonly nats: NatsConnection,
    private readonly topics: GameTopics,
    private readonly logger: Logger,
  ) {}

  publishPlaceBet(payload: {
    idempotencyKey: string;
    playerId: string;
    roundId: string;
    amountCents: number;
    autoCashout?: number;
  }): boolean {
    return this.safePublish(this.topics.CMD_PLACE_BET, payload);
  }

  publishCashout(payload: {
    playerId: string;
    roundId: string;
    betId: string;
  }): boolean {
    return this.safePublish(this.topics.CMD_CASHOUT, payload);
  }

  private safePublish(subject: string, payload: unknown): boolean {
    try {
      this.nats.publish(
        subject,
        this.encoder.encode(JSON.stringify(payload)),
      );
      return true;
    } catch (err) {
      this.logger.error('NATS publish failed', {
        subject,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }
}
