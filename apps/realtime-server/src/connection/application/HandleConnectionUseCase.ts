import { ConnectionId } from '@connection/domain/ConnectionId';
import { Connection } from '@connection/domain/Connection';
import type { ConnectionStore } from '@connection/application/ports/ConnectionStore';
import type { WebSocketSender } from '@connection/application/ports/WebSocketSender';

export interface ConnectInput {
  readonly connectionId: ConnectionId;
  readonly playerId: string;
  readonly operatorId: string;
  readonly connectedAt: number;
}

export type ConnectResult =
  | { success: true }
  | { success: false; error: 'OPERATOR_MISMATCH' };

export class HandleConnectionUseCase {
  constructor(
    private readonly configuredOperatorId: string,
    private readonly connectionStore: ConnectionStore,
    private readonly webSocketSender: WebSocketSender,
  ) {}

  execute(input: ConnectInput): ConnectResult {
    if (input.operatorId !== this.configuredOperatorId) {
      return { success: false, error: 'OPERATOR_MISMATCH' };
    }

    const existing = this.connectionStore.getByPlayerId(input.playerId);
    if (existing) {
      this.webSocketSender.close(existing.id, 4001, 'Replaced by new connection');
      this.connectionStore.remove(existing.id);
    }

    const connection = Connection.create(
      input.connectionId,
      input.playerId,
      input.operatorId,
      input.connectedAt,
    );

    connection.joinRoom();
    this.connectionStore.add(connection);

    return { success: true };
  }
}
