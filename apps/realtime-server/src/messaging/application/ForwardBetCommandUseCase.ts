import type { PlayerConnectionLookup } from '@shared/ports/PlayerConnectionLookup';
import type { MessageBrokerPublisher } from '@messaging/application/ports/MessageBrokerPublisher';
import type { Logger } from '@shared/ports/Logger';
import type { RateLimiter } from '@shared/ports/RateLimiter';

export interface ForwardBetInput {
  readonly playerId: string;
  readonly idempotencyKey: string;
  readonly roundId: string;
  readonly amountCents: number;
  readonly autoCashout?: number;
}

export type ForwardBetResult =
  | { readonly success: true }
  | { readonly success: false; readonly error: 'INVALID_AMOUNT' | 'INVALID_AUTOCASHOUT' | 'NOT_JOINED' | 'RATE_LIMITED' | 'PUBLISH_FAILED' };

export class ForwardBetCommandUseCase {
  constructor(
    private readonly connectionStore: PlayerConnectionLookup,
    private readonly publisher: MessageBrokerPublisher,
    private readonly logger: Logger,
    private readonly rateLimiter: RateLimiter,
  ) {}

  execute(input: ForwardBetInput): ForwardBetResult {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      return { success: false, error: 'INVALID_AMOUNT' };
    }

    if (input.autoCashout !== undefined && input.autoCashout <= 1.0) {
      return { success: false, error: 'INVALID_AUTOCASHOUT' };
    }

    if (!this.rateLimiter.allow(input.playerId, 'place_bet')) {
      return { success: false, error: 'RATE_LIMITED' };
    }

    const connection = this.connectionStore.getByPlayerId(input.playerId);
    if (!connection || !connection.isJoined) {
      return { success: false, error: 'NOT_JOINED' };
    }

    const published = this.publisher.publishPlaceBet({
      idempotencyKey: input.idempotencyKey,
      playerId: input.playerId,
      roundId: input.roundId,
      amountCents: input.amountCents,
      autoCashout: input.autoCashout,
    });

    if (!published) {
      return { success: false, error: 'PUBLISH_FAILED' };
    }

    this.logger.info('Forwarded place_bet command', {
      playerId: input.playerId,
      roundId: input.roundId,
      amountCents: input.amountCents,
    });

    return { success: true };
  }
}
