import type { PlayerConnectionLookup } from '@shared/ports/PlayerConnectionLookup';
import type { MessageBrokerPublisher } from '@messaging/application/ports/MessageBrokerPublisher';
import type { Logger } from '@shared/ports/Logger';
import type { RateLimiter } from '@shared/ports/RateLimiter';

export interface ForwardCashoutInput {
  readonly playerId: string;
  readonly roundId: string;
  readonly betId: string;
}

export type ForwardCashoutResult =
  | { readonly success: true }
  | { readonly success: false; readonly error: 'NOT_JOINED' | 'RATE_LIMITED' | 'PUBLISH_FAILED' };

export class ForwardCashoutCommandUseCase {
  constructor(
    private readonly connectionStore: PlayerConnectionLookup,
    private readonly publisher: MessageBrokerPublisher,
    private readonly logger: Logger,
    private readonly rateLimiter: RateLimiter,
  ) {}

  execute(input: ForwardCashoutInput): ForwardCashoutResult {
    if (!this.rateLimiter.allow(input.playerId, 'cashout')) {
      return { success: false, error: 'RATE_LIMITED' };
    }

    const connection = this.connectionStore.getByPlayerId(input.playerId);
    if (!connection || !connection.isJoined) {
      return { success: false, error: 'NOT_JOINED' };
    }

    const published = this.publisher.publishCashout({
      playerId: input.playerId,
      roundId: input.roundId,
      betId: input.betId,
    });

    if (!published) {
      return { success: false, error: 'PUBLISH_FAILED' };
    }

    this.logger.info('Forwarded cashout command', {
      playerId: input.playerId,
      roundId: input.roundId,
      betId: input.betId,
    });

    return { success: true };
  }
}
