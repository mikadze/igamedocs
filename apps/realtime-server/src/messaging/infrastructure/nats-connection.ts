import { connect, type NatsConnection, Events, DebugEvents } from 'nats';
import type { Logger } from '@shared/ports/Logger';

export interface NatsConnectionResult {
  nc: NatsConnection;
  isConnected: () => boolean;
}

/**
 * Creates a NATS connection with infinite reconnection and status monitoring.
 * Blocks until the first connect succeeds (or throws on permanent failure).
 */
export async function createNatsConnection(
  natsUrl: string,
  logger: Logger,
  natsToken?: string,
): Promise<NatsConnectionResult> {
  const nc = await connect({
    servers: natsUrl,
    name: 'realtime-server',
    maxReconnectAttempts: -1,
    reconnectTimeWait: 2_000,
    waitOnFirstConnect: true,
    ...(natsToken ? { token: natsToken } : {}),
  });

  monitorStatus(nc, logger);

  const isConnected = (): boolean => {
    return !nc.isClosed() && !nc.isDraining();
  };

  return { nc, isConnected };
}

function monitorStatus(nc: NatsConnection, logger: Logger): void {
  (async () => {
    for await (const status of nc.status()) {
      switch (status.type) {
        case Events.Disconnect:
          logger.warn('NATS disconnected', { data: String(status.data) });
          break;
        case Events.Reconnect:
          logger.warn('NATS reconnected', { data: String(status.data) });
          break;
        case Events.Error:
          logger.error('NATS error', { data: String(status.data) });
          break;
        case Events.LDM:
          logger.warn('NATS server entering lame duck mode', {
            data: String(status.data),
          });
          break;
        case DebugEvents.Reconnecting:
          logger.warn('NATS reconnecting...', { data: String(status.data) });
          break;
        default:
          break;
      }
    }
  })().catch((err) => {
    logger.error('NATS status monitor crashed', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
