import type { ServerWebSocket } from 'bun';
import type { HandleConnectionUseCase } from '@connection/application/HandleConnectionUseCase';
import type { HandleDisconnectionUseCase } from '@connection/application/HandleDisconnectionUseCase';
import type { RouteClientMessageUseCase } from '@messaging/application/RouteClientMessageUseCase';
import type { MessageSerializer } from '@messaging/application/ports/MessageSerializer';
import type { SocketRegistry } from '@transport/SocketRegistry';
import type { Logger } from '@shared/ports/Logger';
import type { WsData } from '@transport/wsTypes';

export interface WsHandlerDeps {
  readonly handleConnection: HandleConnectionUseCase;
  readonly handleDisconnection: HandleDisconnectionUseCase;
  readonly routeClientMessage: RouteClientMessageUseCase;
  readonly serializer: MessageSerializer;
  readonly senderAdapter: SocketRegistry;
  readonly logger: Logger;
}

export function createWsHandlers(deps: WsHandlerDeps) {
  const PONG_BYTES = deps.serializer.encodeServerMessage({ type: 'pong' });

  return {
    open(ws: ServerWebSocket<WsData>) {
      const connectionId = ws.data.connectionId;

      deps.senderAdapter.register(connectionId, ws);

      const result = deps.handleConnection.execute({
        connectionId,
        playerId: ws.data.playerId,
        operatorId: ws.data.operatorId,
        connectedAt: Date.now(),
      });

      if (!result.success) {
        deps.logger.warn('Connection rejected', { error: result.error });
        deps.senderAdapter.unregister(connectionId);
        ws.close(4003, result.error);
      }
    },

    message(ws: ServerWebSocket<WsData>, raw: Buffer | ArrayBuffer | string) {
      if (typeof raw === 'string') {
        ws.sendBinary(
          deps.serializer.encodeServerMessage({
            type: 'error',
            code: 'INVALID_FORMAT',
            message: 'Binary messages only',
          }),
        );
        return;
      }

      try {
        const data =
          raw instanceof Uint8Array ? raw : new Uint8Array(raw);
        const msg = deps.serializer.decodeClientMessage(data);

        // Ping/pong is transport-level keepalive — exempt from rate limiting
        if (msg.type === 'ping') {
          ws.sendBinary(PONG_BYTES);
          return;
        }

        // Rate limit non-ping messages before routing to NATS
        if (!ws.data.rateLimiter.consume()) {
          ws.sendBinary(
            deps.serializer.encodeServerMessage({
              type: 'error',
              code: 'RATE_LIMITED',
              message: 'Too many messages',
            }),
          );
          return;
        }

        const result = deps.routeClientMessage.execute({
          connectionId: ws.data.connectionId,
          message: msg,
        });

        if (!result.success) {
          ws.sendBinary(
            deps.serializer.encodeServerMessage({
              type: 'error',
              code: result.error,
              message: result.error,
            }),
          );
        }
      } catch (err) {
        deps.logger.error('Failed to decode client message', {
          connectionId: ws.data.connectionId.value,
          error: err instanceof Error ? err.message : String(err),
        });
        ws.sendBinary(
          deps.serializer.encodeServerMessage({
            type: 'error',
            code: 'INVALID_MESSAGE',
            message: 'Failed to decode message',
          }),
        );
      }
    },

    close(ws: ServerWebSocket<WsData>, code: number, reason: string) {
      deps.senderAdapter.unregister(ws.data.connectionId);
      deps.handleDisconnection.execute({
        connectionId: ws.data.connectionId,
      });
    },
  };
}
