import type { ServerMessage } from '@messaging/domain/ServerMessage';
import type { ClientMessage } from '@messaging/domain/ClientMessage';

export interface MessageSerializer {
  encodeServerMessage(message: ServerMessage): Uint8Array;
  decodeClientMessage(data: Uint8Array): ClientMessage;
}
