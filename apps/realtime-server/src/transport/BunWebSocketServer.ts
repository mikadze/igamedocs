import type { RealtimeConfig } from '@config/RealtimeConfig';
import type { AuthGateway } from '@connection/application/ports/AuthGateway';
import type { ConnectionStore } from '@connection/application/ports/ConnectionStore';
import type { HandleConnectionUseCase } from '@connection/application/HandleConnectionUseCase';
import type { HandleDisconnectionUseCase } from '@connection/application/HandleDisconnectionUseCase';
import type { RouteClientMessageUseCase } from '@messaging/application/RouteClientMessageUseCase';
import type { MessageSerializer } from '@messaging/application/ports/MessageSerializer';
import type { Logger } from '@shared/ports/Logger';
import { WebSocketSenderAdapter } from '@transport/WebSocketSenderAdapter';
import { handleUpgrade } from '@transport/upgradeHandler';
import { createWsHandlers } from '@transport/wsHandlers';
import type { WsData } from '@transport/wsTypes';

export interface BunWebSocketServerDeps {
  readonly config: RealtimeConfig;
  readonly authGateway: AuthGateway;
  readonly connectionStore: ConnectionStore;
  readonly handleConnection: HandleConnectionUseCase;
  readonly handleDisconnection: HandleDisconnectionUseCase;
  readonly routeClientMessage: RouteClientMessageUseCase;
  readonly serializer: MessageSerializer;
  readonly senderAdapter: WebSocketSenderAdapter;
  readonly logger: Logger;
  readonly isNatsConnected?: () => boolean;
}

export class BunWebSocketServer {
  private server: ReturnType<typeof Bun.serve> | null = null;
  private readonly startTime = Date.now();

  constructor(private readonly deps: BunWebSocketServerDeps) {}

  start(): ReturnType<typeof Bun.serve> {
    const { deps } = this;
    const wsHandlers = createWsHandlers({
      handleConnection: deps.handleConnection,
      handleDisconnection: deps.handleDisconnection,
      routeClientMessage: deps.routeClientMessage,
      serializer: deps.serializer,
      senderAdapter: deps.senderAdapter,
      logger: deps.logger,
    });

    this.server = Bun.serve<WsData>({
      port: deps.config.wsPort,

      fetch: async (req, server) => {
        const url = new URL(req.url);

        // Liveness probe — always returns 200
        if (req.method === 'GET' && url.pathname === '/healthz') {
          return Response.json({ status: 'ok' });
        }

        // Readiness probe — includes internal state
        if (req.method === 'GET' && url.pathname === '/health') {
          return Response.json({
            status: 'ok',
            connections: deps.connectionStore.count(),
            nats: deps.isNatsConnected?.() ?? 'unknown',
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
          });
        }

        // WebSocket upgrade
        const upgradeResult = await handleUpgrade(req, server, {
          authGateway: deps.authGateway,
          connectionStore: deps.connectionStore,
          maxConnections: deps.config.maxConnections,
          allowedOrigins: deps.config.allowedOrigins,
        });

        if (upgradeResult) return upgradeResult;

        // Bun returns undefined on successful upgrade
        return undefined as any;
      },

      websocket: {
        ...wsHandlers,
        maxPayloadLength: 4096,
      },
    });

    deps.senderAdapter.setServer(this.server);

    deps.logger.info('WebSocket server started', {
      port: deps.config.wsPort,
    });

    return this.server;
  }

  stop(): void {
    this.server?.stop(true);
    this.server = null;
  }
}
