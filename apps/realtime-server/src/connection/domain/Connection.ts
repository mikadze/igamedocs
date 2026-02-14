import { ConnectionId } from '@connection/domain/ConnectionId';
import { ConnectionState } from '@connection/domain/ConnectionState';
import { InvalidStateTransition } from '@shared/kernel/DomainError';

export class Connection {
  private constructor(
    readonly id: ConnectionId,
    readonly playerId: string,
    readonly operatorId: string,
    private _state: ConnectionState,
    readonly connectedAt: number,
  ) {}

  static create(
    id: ConnectionId,
    playerId: string,
    operatorId: string,
    connectedAt: number,
  ): Connection {
    return new Connection(
      id,
      playerId,
      operatorId,
      ConnectionState.AUTHENTICATED,
      connectedAt,
    );
  }

  joinRoom(): void {
    if (this._state !== ConnectionState.AUTHENTICATED) {
      throw new InvalidStateTransition(`Cannot join from ${this._state}`);
    }
    this._state = ConnectionState.JOINED;
  }

  disconnect(): void {
    this._state = ConnectionState.DISCONNECTED;
  }

  get state(): ConnectionState {
    return this._state;
  }

  get isJoined(): boolean {
    return this._state === ConnectionState.JOINED;
  }
}
