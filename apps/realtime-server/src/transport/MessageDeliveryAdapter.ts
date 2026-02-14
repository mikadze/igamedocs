import type { MessageDelivery } from '@messaging/application/ports/MessageDelivery';
import type { WebSocketSender } from '@connection/application/ports/WebSocketSender';
import type { PlayerConnectionLookup } from '@shared/ports/PlayerConnectionLookup';
import type { Logger } from '@shared/ports/Logger';

export class MessageDeliveryAdapter implements MessageDelivery {
  constructor(
    private readonly sender: WebSocketSender,
    private readonly connectionStore: PlayerConnectionLookup,
    private readonly logger: Logger,
  ) {}

  sendToPlayer(playerId: string, data: Uint8Array): void {
    const connection = this.connectionStore.getByPlayerId(playerId);
    if (!connection || !connection.isJoined) {
      this.logger.warn('Cannot send player-specific message: player not joined', {
        playerId,
      });
      return;
    }
    this.sender.send(connection.id, data);
  }

  broadcastToAll(data: Uint8Array): void {
    this.sender.broadcastToAllJoined(data);
  }
}
