import type { ServerMessage } from '@messaging/domain/ServerMessage';
import type { PlayerConnectionLookup } from '@shared/ports/PlayerConnectionLookup';
import type { WebSocketSender } from '@connection/application/ports/WebSocketSender';
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
    private readonly connectionStore: PlayerConnectionLookup,
    private readonly sender: WebSocketSender,
    private readonly serializer: MessageSerializer,
    private readonly logger: Logger,
  ) {}

  execute(input: BroadcastInput): void {
    const encoded = this.serializer.encodeServerMessage(input.serverMessage);

    if (
      input.targetPlayerId &&
      PLAYER_SPECIFIC_TYPES.has(input.serverMessage.type)
    ) {
      this.sendToPlayer(input.targetPlayerId, encoded);
      return;
    }

    this.broadcastToAll(encoded);
  }

  private sendToPlayer(playerId: string, data: Uint8Array): void {
    const connection = this.connectionStore.getByPlayerId(playerId);
    if (!connection || !connection.isJoined) {
      this.logger.warn(
        'Cannot send player-specific message: player not joined',
        { playerId },
      );
      return;
    }
    this.sender.send(connection.id, data);
  }

  private broadcastToAll(data: Uint8Array): void {
    this.sender.broadcastToAllJoined(data);
  }
}
