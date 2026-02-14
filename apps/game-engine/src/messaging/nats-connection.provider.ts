import { Provider } from '@nestjs/common';
import { connect, NatsConnection, Events, DebugEvents } from 'nats';
import { z } from 'zod';
import { NATS_CONNECTION, LOGGER } from './tokens';
import { Logger } from '@shared/ports/Logger';

export const natsUrlSchema = z
  .string({ error: 'NATS_URL is required' })
  .regex(
    /^(nats|tls):\/\/[^\s]+$/,
    'NATS_URL must use nats:// or tls:// scheme',
  );

export const natsConnectionProvider: Provider = {
  provide: NATS_CONNECTION,
  useFactory: async (logger: Logger): Promise<NatsConnection> => {
    const result = natsUrlSchema.safeParse(process.env.NATS_URL);

    if (!result.success) {
      const messages = result.error.issues
        .map((issue) => `  - ${issue.message}`)
        .join('\n');
      throw new Error(`[MessagingModule] Invalid NATS_URL:\n${messages}`);
    }

    const nc = await connect({
      servers: result.data,
      name: 'crash-game-engine',
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2_000,
      waitOnFirstConnect: true,
    });

    monitorStatus(nc, logger);

    return nc;
  },
  inject: [LOGGER],
};

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
