import { loadConfig } from '@config/config.schema';
import { createTopics } from '@messaging/infrastructure/topics';
import { createNatsConnection } from '@messaging/infrastructure/nats-connection';
import { NatsPublisher } from '@messaging/infrastructure/NatsPublisher';
import { NatsSubscriber } from '@messaging/infrastructure/NatsSubscriber';
import { BroadcastGameEventUseCase } from '@messaging/application/BroadcastGameEventUseCase';
import { ForwardBetCommandUseCase } from '@messaging/application/ForwardBetCommandUseCase';
import { ForwardCashoutCommandUseCase } from '@messaging/application/ForwardCashoutCommandUseCase';
import { RouteClientMessageUseCase } from '@messaging/application/RouteClientMessageUseCase';
import { HandleConnectionUseCase } from '@connection/application/HandleConnectionUseCase';
import { HandleDisconnectionUseCase } from '@connection/application/HandleDisconnectionUseCase';
import { InMemoryConnectionStore } from '@connection/infrastructure/InMemoryConnectionStore';
import { JwtAuthGateway } from '@connection/infrastructure/JwtAuthGateway';
import { ProtobufSerializer } from '@messaging/infrastructure/ProtobufSerializer';
import { MessageDeliveryAdapter } from '@transport/MessageDeliveryAdapter';
import { WebSocketSenderAdapter } from '@transport/WebSocketSenderAdapter';
import { InMemoryRateLimiter } from '@messaging/infrastructure/InMemoryRateLimiter';
import { BunWebSocketServer } from '@transport/BunWebSocketServer';
import { ConsoleLogger } from '@shared/infrastructure/ConsoleLogger';

// ──── 1. Config ─────────────────────────────────────────────────

const { raw, config } = loadConfig();
const topics = createTopics(config.operatorId);
const logger = new ConsoleLogger();

// ──── 2. NATS Connection ────────────────────────────────────────

const { nc, isConnected } = await createNatsConnection(raw.NATS_URL, logger, raw.NATS_TOKEN);
const sanitizedNatsUrl = raw.NATS_URL.replace(/:\/\/[^@]*@/, '://***@');
logger.info('NATS connected', { url: sanitizedNatsUrl });

// ──── 3. Infrastructure Adapters ────────────────────────────────

const connectionStore = new InMemoryConnectionStore();
const senderAdapter = new WebSocketSenderAdapter();
const serializer = new ProtobufSerializer();
const rateLimiter = new InMemoryRateLimiter();
const rateLimiterCleanup = setInterval(() => rateLimiter.cleanup(), 60_000);
const authGateway = new JwtAuthGateway(raw.JWT_PUBLIC_KEY);

const publisher = new NatsPublisher(nc, topics, logger);
const subscriber = new NatsSubscriber(nc, topics, logger);

const delivery = new MessageDeliveryAdapter(senderAdapter, connectionStore, logger);

// ──── 4. Use Cases ──────────────────────────────────────────────

const broadcastGameEvent = new BroadcastGameEventUseCase(delivery, serializer, logger);
const forwardBet = new ForwardBetCommandUseCase(connectionStore, publisher, logger, rateLimiter);
const forwardCashout = new ForwardCashoutCommandUseCase(connectionStore, publisher, logger, rateLimiter);
const routeClientMessage = new RouteClientMessageUseCase(connectionStore, forwardBet, forwardCashout, logger);
const handleConnection = new HandleConnectionUseCase(config.operatorId, connectionStore, senderAdapter);
const handleDisconnection = new HandleDisconnectionUseCase(connectionStore);

// ──── 5. Wire NATS Events → BroadcastGameEvent ─────────────────

subscriber.onRoundNew((data) => {
  broadcastGameEvent.execute({
    serverMessage: { type: 'round_new', roundId: data.roundId, hashedSeed: data.hashedSeed },
  });
});

subscriber.onRoundBetting((data) => {
  broadcastGameEvent.execute({
    serverMessage: { type: 'round_betting', roundId: data.roundId, endsAt: data.endsAt },
  });
});

subscriber.onRoundStarted((data) => {
  broadcastGameEvent.execute({
    serverMessage: { type: 'round_started', roundId: data.roundId },
  });
});

subscriber.onRoundCrashed((data) => {
  broadcastGameEvent.execute({
    serverMessage: {
      type: 'round_crashed',
      roundId: data.roundId,
      crashPoint: data.crashPoint,
      serverSeed: data.serverSeed,
    },
  });
});

subscriber.onTick((data) => {
  broadcastGameEvent.execute({
    serverMessage: {
      type: 'tick',
      roundId: data.roundId,
      multiplier: data.multiplier,
      elapsedMs: data.elapsedMs,
    },
  });
});

subscriber.onBetPlaced((data) => {
  broadcastGameEvent.execute({
    serverMessage: {
      type: 'bet_placed',
      betId: data.betId,
      playerId: data.playerId,
      roundId: data.roundId,
      amountCents: data.amountCents,
    },
  });
});

subscriber.onBetWon((data) => {
  broadcastGameEvent.execute({
    serverMessage: {
      type: 'bet_won',
      betId: data.betId,
      playerId: data.playerId,
      roundId: data.roundId,
      amountCents: data.amountCents,
      cashoutMultiplier: data.cashoutMultiplier,
      payoutCents: data.payoutCents,
    },
  });
});

subscriber.onBetLost((data) => {
  broadcastGameEvent.execute({
    serverMessage: {
      type: 'bet_lost',
      betId: data.betId,
      playerId: data.playerId,
      roundId: data.roundId,
      amountCents: data.amountCents,
      crashPoint: data.crashPoint,
    },
  });
});

subscriber.onBetRejected((data) => {
  broadcastGameEvent.execute({
    serverMessage: {
      type: 'bet_rejected',
      playerId: data.playerId,
      roundId: data.roundId,
      amountCents: data.amountCents,
      error: data.error,
    },
    targetPlayerId: data.playerId,
  });
});

subscriber.onCreditFailed((data) => {
  broadcastGameEvent.execute({
    serverMessage: {
      type: 'credit_failed',
      playerId: data.playerId,
      betId: data.betId,
      roundId: data.roundId,
      payoutCents: data.payoutCents,
      reason: data.reason,
    },
    targetPlayerId: data.playerId,
  });
});

// ──── 6. Start WebSocket Server ─────────────────────────────────

const wsServer = new BunWebSocketServer({
  config,
  authGateway,
  connectionStore,
  handleConnection,
  handleDisconnection,
  routeClientMessage,
  serializer,
  senderAdapter,
  logger,
  isNatsConnected: isConnected,
});

wsServer.start();

logger.info(`Realtime server started for operator: ${config.operatorId}`, {
  port: config.wsPort,
  natsUrl: sanitizedNatsUrl,
  maxConnections: config.maxConnections,
});

// ──── 7. Graceful Shutdown ──────────────────────────────────────

const shutdown = async () => {
  logger.info('Shutting down...');
  await subscriber.close();
  await nc.drain();
  clearInterval(rateLimiterCleanup);
  await new Promise((resolve) => setTimeout(resolve, 500));
  wsServer.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
