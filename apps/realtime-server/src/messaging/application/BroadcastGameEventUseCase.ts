import type { ServerMessage } from '@messaging/domain/ServerMessage';
import type { MessageDelivery } from '@messaging/application/ports/MessageDelivery';
import type { MessageSerializer } from '@messaging/application/ports/MessageSerializer';
import type { Logger } from '@shared/ports/Logger';

export interface BroadcastInput {
  readonly serverMessage: ServerMessage;
  readonly targetPlayerId?: string;
}

const PLAYER_SPECIFIC_TYPES: ReadonlySet<string> = new Set([
  'bet_rejected',
  'credit_failed',
]);

export class BroadcastGameEventUseCase {
  constructor(
    private readonly delivery: MessageDelivery,
    private readonly serializer: MessageSerializer,
    private readonly logger: Logger,
  ) {}

  execute(input: BroadcastInput): void {
    const encoded = this.serializer.encodeServerMessage(input.serverMessage);

    if (
      input.targetPlayerId &&
      PLAYER_SPECIFIC_TYPES.has(input.serverMessage.type)
    ) {
      this.delivery.sendToPlayer(input.targetPlayerId, encoded);
      return;
    }

    this.delivery.broadcastToAll(encoded);
  }
}
