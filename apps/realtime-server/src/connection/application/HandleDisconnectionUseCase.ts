import type { ConnectionId } from '@connection/domain/ConnectionId';
import type { ConnectionStore } from '@connection/application/ports/ConnectionStore';

export interface DisconnectInput {
  readonly connectionId: ConnectionId;
}

export class HandleDisconnectionUseCase {
  constructor(
    private readonly connectionStore: ConnectionStore,
  ) {}

  execute(input: DisconnectInput): void {
    const connection = this.connectionStore.getById(input.connectionId);
    if (!connection) {
      return;
    }

    connection.disconnect();
    this.connectionStore.remove(input.connectionId);
  }
}
