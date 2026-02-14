import { generateKeyPair, exportSPKI, SignJWT } from 'jose';
import { create, toBinary, fromBinary } from '@bufbuild/protobuf';
import type { NatsConnection, Subscription } from 'nats';
import { createNatsConnection } from '@messaging/infrastructure/nats-connection';
import { createTopics, type GameTopics } from '@messaging/infrastructure/topics';
import { InMemoryConnectionStore } from '@connection/infrastructure/InMemoryConnectionStore';
import { JwtAuthGateway } from '@connection/infrastructure/JwtAuthGateway';
import { ProtobufSerializer } from '@messaging/infrastructure/ProtobufSerializer';
import { InMemoryRateLimiter } from '@messaging/infrastructure/InMemoryRateLimiter';
import { WebSocketSenderAdapter } from '@transport/WebSocketSenderAdapter';
import { MessageDeliveryAdapter } from '@transport/MessageDeliveryAdapter';
import { NatsPublisher } from '@messaging/infrastructure/NatsPublisher';
import { NatsSubscriber } from '@messaging/infrastructure/NatsSubscriber';
import { BroadcastGameEventUseCase } from '@messaging/application/BroadcastGameEventUseCase';
import { ForwardBetCommandUseCase } from '@messaging/application/ForwardBetCommandUseCase';
import { ForwardCashoutCommandUseCase } from '@messaging/application/ForwardCashoutCommandUseCase';
import { RouteClientMessageUseCase } from '@messaging/application/RouteClientMessageUseCase';
import { HandleConnectionUseCase } from '@connection/application/HandleConnectionUseCase';
import { HandleDisconnectionUseCase } from '@connection/application/HandleDisconnectionUseCase';
import { BunWebSocketServer } from '@transport/BunWebSocketServer';
import { ConsoleLogger } from '@shared/infrastructure/ConsoleLogger';
import type { ServerMessage } from '@messaging/domain/ServerMessage';
import {
  ServerMessageSchema,
} from '@generated/server_message_pb';
import {
  ClientMessageSchema,
  PlaceBetSchema,
  CashoutSchema,
  PingSchema,
} from '@generated/client_message_pb';

// ──── Auth Fixtures ─────────────────────────────────────────────

export interface AuthFixtures {
  privateKey: CryptoKey;
  publicKeyPem: string;
  signToken(claims: { playerId: string; operatorId: string }): Promise<string>;
  signExpiredToken(claims: { playerId: string; operatorId: string }): Promise<string>;
}

export async function createAuthFixtures(): Promise<AuthFixtures> {
  const keyPair = await generateKeyPair('RS256');
  const publicKeyPem = await exportSPKI(keyPair.publicKey);

  return {
    privateKey: keyPair.privateKey,
    publicKeyPem,
    async signToken(claims) {
      return new SignJWT(claims as any)
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(keyPair.privateKey);
    },
    async signExpiredToken(claims) {
      return new SignJWT(claims as any)
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt()
        .setExpirationTime('-1s')
        .sign(keyPair.privateKey);
    },
  };
}

// ──── Test Server ───────────────────────────────────────────────

export interface TestServerContext {
  server: ReturnType<typeof Bun.serve>;
  wsServer: BunWebSocketServer;
  nc: NatsConnection;
  topics: GameTopics;
  connectionStore: InMemoryConnectionStore;
  subscriber: NatsSubscriber;
  auth: AuthFixtures;
  port: number;
  url: string;
  teardown(): Promise<void>;
}

export async function createTestServer(opts?: {
  operatorId?: string;
}): Promise<TestServerContext> {
  const operatorId = opts?.operatorId ?? 'test-op';
  const auth = await createAuthFixtures();
  const logger = new ConsoleLogger();
  const topics = createTopics(operatorId);

  const { nc, isConnected } = await createNatsConnection(
    'nats://localhost:4222',
    logger,
  );

  const connectionStore = new InMemoryConnectionStore();
  const senderAdapter = new WebSocketSenderAdapter();
  const serializer = new ProtobufSerializer();
  const rateLimiter = new InMemoryRateLimiter();
  const authGateway = new JwtAuthGateway(auth.publicKeyPem);
  const publisher = new NatsPublisher(nc, topics, logger);
  const subscriber = new NatsSubscriber(nc, topics, logger);
  const delivery = new MessageDeliveryAdapter(senderAdapter, connectionStore, logger);

  const broadcastGameEvent = new BroadcastGameEventUseCase(delivery, serializer, logger);
  const forwardBet = new ForwardBetCommandUseCase(connectionStore, publisher, logger, rateLimiter);
  const forwardCashout = new ForwardCashoutCommandUseCase(connectionStore, publisher, logger, rateLimiter);
  const routeClientMessage = new RouteClientMessageUseCase(connectionStore, forwardBet, forwardCashout, logger);
  const handleConnection = new HandleConnectionUseCase(operatorId, connectionStore, senderAdapter);
  const handleDisconnection = new HandleDisconnectionUseCase(connectionStore);

  // Wire NATS events → BroadcastGameEvent (mirrors main.ts lines 58-162)
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
      serverMessage: { type: 'round_crashed', roundId: data.roundId, crashPoint: data.crashPoint, serverSeed: data.serverSeed },
    });
  });
  subscriber.onTick((data) => {
    broadcastGameEvent.execute({
      serverMessage: { type: 'tick', roundId: data.roundId, multiplier: data.multiplier, elapsedMs: data.elapsedMs },
    });
  });
  subscriber.onBetPlaced((data) => {
    broadcastGameEvent.execute({
      serverMessage: { type: 'bet_placed', betId: data.betId, playerId: data.playerId, roundId: data.roundId, amountCents: data.amountCents },
    });
  });
  subscriber.onBetWon((data) => {
    broadcastGameEvent.execute({
      serverMessage: { type: 'bet_won', betId: data.betId, playerId: data.playerId, roundId: data.roundId, amountCents: data.amountCents, cashoutMultiplier: data.cashoutMultiplier, payoutCents: data.payoutCents },
    });
  });
  subscriber.onBetLost((data) => {
    broadcastGameEvent.execute({
      serverMessage: { type: 'bet_lost', betId: data.betId, playerId: data.playerId, roundId: data.roundId, amountCents: data.amountCents, crashPoint: data.crashPoint },
    });
  });
  subscriber.onBetRejected((data) => {
    broadcastGameEvent.execute({
      serverMessage: { type: 'bet_rejected', playerId: data.playerId, roundId: data.roundId, amountCents: data.amountCents, error: data.error },
      targetPlayerId: data.playerId,
    });
  });
  subscriber.onCreditFailed((data) => {
    broadcastGameEvent.execute({
      serverMessage: { type: 'credit_failed', playerId: data.playerId, betId: data.betId, roundId: data.roundId, payoutCents: data.payoutCents, reason: data.reason },
      targetPlayerId: data.playerId,
    });
  });

  const config = {
    operatorId,
    wsPort: 0,
    maxConnections: 10_000,
    allowedOrigins: [] as string[],
  };

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

  const bunServer = wsServer.start();
  const port = bunServer.port!;

  return {
    server: bunServer,
    wsServer,
    nc,
    topics,
    connectionStore,
    subscriber,
    auth,
    port,
    url: `ws://localhost:${port}`,
    async teardown() {
      await subscriber.close();
      await nc.drain();
      wsServer.stop();
    },
  };
}

// ──── WebSocket Test Client ─────────────────────────────────────

export interface TestWsClient {
  ws: WebSocket;
  messages: ServerMessage[];
  waitForMessage<T extends ServerMessage['type']>(
    type: T,
    timeoutMs?: number,
  ): Promise<Extract<ServerMessage, { type: T }>>;
  waitForClose(timeoutMs?: number): Promise<{ code: number; reason: string }>;
  sendPlaceBet(params: {
    idempotencyKey: string;
    roundId: string;
    amountCents: number;
    autoCashout?: number;
  }): void;
  sendCashout(params: { roundId: string; betId: string }): void;
  sendPing(): void;
  close(): void;
}

function decodeServerMessage(data: ArrayBuffer): ServerMessage {
  const pb = fromBinary(ServerMessageSchema, new Uint8Array(data));
  switch (pb.payload.case) {
    case 'roundNew':
      return { type: 'round_new', roundId: pb.payload.value.roundId, hashedSeed: pb.payload.value.hashedSeed };
    case 'roundBetting':
      return { type: 'round_betting', roundId: pb.payload.value.roundId, endsAt: Number(pb.payload.value.endsAt) };
    case 'roundStarted':
      return { type: 'round_started', roundId: pb.payload.value.roundId };
    case 'roundCrashed':
      return { type: 'round_crashed', roundId: pb.payload.value.roundId, crashPoint: pb.payload.value.crashPoint, serverSeed: pb.payload.value.serverSeed };
    case 'tick':
      return { type: 'tick', roundId: pb.payload.value.roundId, multiplier: pb.payload.value.multiplier, elapsedMs: pb.payload.value.elapsedMs };
    case 'betPlaced':
      return { type: 'bet_placed', betId: pb.payload.value.betId, playerId: pb.payload.value.playerId, roundId: pb.payload.value.roundId, amountCents: pb.payload.value.amountCents };
    case 'betWon':
      return { type: 'bet_won', betId: pb.payload.value.betId, playerId: pb.payload.value.playerId, roundId: pb.payload.value.roundId, amountCents: pb.payload.value.amountCents, cashoutMultiplier: pb.payload.value.cashoutMultiplier, payoutCents: pb.payload.value.payoutCents };
    case 'betLost':
      return { type: 'bet_lost', betId: pb.payload.value.betId, playerId: pb.payload.value.playerId, roundId: pb.payload.value.roundId, amountCents: pb.payload.value.amountCents, crashPoint: pb.payload.value.crashPoint };
    case 'betRejected':
      return { type: 'bet_rejected', playerId: pb.payload.value.playerId, roundId: pb.payload.value.roundId, amountCents: pb.payload.value.amountCents, error: pb.payload.value.error };
    case 'pong':
      return { type: 'pong' };
    case 'error':
      return { type: 'error', code: pb.payload.value.code, message: pb.payload.value.message };
    case 'reAuthRequired':
      return { type: 're_auth_required', deadlineMs: Number(pb.payload.value.deadlineMs) };
    case 'creditFailed':
      return { type: 'credit_failed', playerId: pb.payload.value.playerId, betId: pb.payload.value.betId, roundId: pb.payload.value.roundId, payoutCents: pb.payload.value.payoutCents, reason: pb.payload.value.reason };
    default:
      throw new Error(`Unknown server message case: ${(pb.payload as any).case}`);
  }
}

export function connectClient(url: string, token: string): Promise<TestWsClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${url}?token=${token}`);
    ws.binaryType = 'arraybuffer';

    const messages: ServerMessage[] = [];
    const waiters: Array<{ type: string; resolve: (msg: any) => void; timer: ReturnType<typeof setTimeout> }> = [];
    let closeWaiters: Array<{ resolve: (ev: { code: number; reason: string }) => void; timer: ReturnType<typeof setTimeout> }> = [];
    let closeEvent: { code: number; reason: string } | null = null;

    ws.onmessage = (event) => {
      const msg = decodeServerMessage(event.data as ArrayBuffer);

      const idx = waiters.findIndex((w) => w.type === msg.type);
      if (idx !== -1) {
        const waiter = waiters.splice(idx, 1)[0];
        clearTimeout(waiter.timer);
        waiter.resolve(msg);
      } else {
        messages.push(msg);
      }
    };

    ws.onclose = (event) => {
      closeEvent = { code: event.code, reason: event.reason };
      for (const w of closeWaiters) {
        clearTimeout(w.timer);
        w.resolve(closeEvent);
      }
      closeWaiters = [];
    };

    ws.onopen = () => {
      resolve({
        ws,
        messages,
        waitForMessage(type, timeoutMs = 3000) {
          const existing = messages.find((m) => m.type === type);
          if (existing) {
            messages.splice(messages.indexOf(existing), 1);
            return Promise.resolve(existing as any);
          }
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              const idx = waiters.findIndex((w) => w.resolve === res);
              if (idx !== -1) waiters.splice(idx, 1);
              rej(new Error(`Timeout waiting for message type "${type}" after ${timeoutMs}ms`));
            }, timeoutMs);
            waiters.push({ type, resolve: res, timer });
          });
        },
        waitForClose(timeoutMs = 3000) {
          if (closeEvent) {
            return Promise.resolve(closeEvent);
          }
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              rej(new Error(`Timeout waiting for close after ${timeoutMs}ms`));
            }, timeoutMs);
            closeWaiters.push({ resolve: res, timer });
          });
        },
        sendPlaceBet(params) {
          const bet = create(PlaceBetSchema);
          bet.idempotencyKey = params.idempotencyKey;
          bet.roundId = params.roundId;
          bet.amountCents = params.amountCents;
          if (params.autoCashout !== undefined) {
            bet.autoCashout = params.autoCashout;
          }
          const msg = create(ClientMessageSchema);
          msg.payload = { case: 'placeBet', value: bet };
          ws.send(toBinary(ClientMessageSchema, msg));
        },
        sendCashout(params) {
          const cashout = create(CashoutSchema);
          cashout.roundId = params.roundId;
          cashout.betId = params.betId;
          const msg = create(ClientMessageSchema);
          msg.payload = { case: 'cashout', value: cashout };
          ws.send(toBinary(ClientMessageSchema, msg));
        },
        sendPing() {
          const ping = create(PingSchema);
          const msg = create(ClientMessageSchema);
          msg.payload = { case: 'ping', value: ping };
          ws.send(toBinary(ClientMessageSchema, msg));
        },
        close() {
          ws.close();
        },
      });
    };

    ws.onerror = () => {
      reject(new Error('WebSocket connection failed'));
    };
  });
}

export function connectClientRaw(url: string): Promise<{ ws: WebSocket; waitForClose(timeoutMs?: number): Promise<{ code: number; reason: string }> }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    let closeWaiters: Array<{ resolve: (ev: { code: number; reason: string }) => void; timer: ReturnType<typeof setTimeout> }> = [];

    ws.onclose = (event) => {
      for (const w of closeWaiters) {
        clearTimeout(w.timer);
        w.resolve({ code: event.code, reason: event.reason });
      }
      closeWaiters = [];
      // If we haven't resolved yet, resolve with the close event
      resolve({
        ws,
        waitForClose(timeoutMs = 3000) {
          return Promise.resolve({ code: event.code, reason: event.reason });
        },
      });
    };

    ws.onopen = () => {
      resolve({
        ws,
        waitForClose(timeoutMs = 3000) {
          if (ws.readyState === WebSocket.CLOSED) {
            return Promise.resolve({ code: 0, reason: '' });
          }
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              rej(new Error(`Timeout waiting for close after ${timeoutMs}ms`));
            }, timeoutMs);
            closeWaiters.push({ resolve: res, timer });
          });
        },
      });
    };

    ws.onerror = () => {
      // Don't reject — the close event will handle it
    };

    // Timeout for connection attempt
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
        reject(new Error('Connection timeout'));
      }
    }, 5000);
  });
}

// ──── Game Engine Simulator ─────────────────────────────────────

export interface GameEngineSimulator {
  publishRoundNew(data: { roundId: string; hashedSeed: string }): void;
  publishRoundBetting(data: { roundId: string; endsAt: number }): void;
  publishRoundStarted(data: { roundId: string }): void;
  publishRoundCrashed(data: { roundId: string; crashPoint: number; serverSeed: string }): void;
  publishTick(data: { roundId: string; multiplier: number; elapsedMs: number }): void;
  publishBetPlaced(data: { betId: string; playerId: string; roundId: string; amountCents: number; status: string }): void;
  publishBetWon(data: { betId: string; playerId: string; roundId: string; amountCents: number; status: string; cashoutMultiplier: number; payoutCents: number }): void;
  publishBetLost(data: { betId: string; playerId: string; roundId: string; amountCents: number; status: string; crashPoint: number }): void;
  publishBetRejected(data: { playerId: string; roundId: string; amountCents: number; error: string }): void;
  publishCreditFailed(data: { playerId: string; betId: string; roundId: string; payoutCents: number; reason: string }): void;
}

export function createGameEngineSimulator(
  nc: NatsConnection,
  topics: GameTopics,
): GameEngineSimulator {
  const encoder = new TextEncoder();
  const pub = (subject: string, data: unknown) => {
    nc.publish(subject, encoder.encode(JSON.stringify(data)));
  };

  return {
    publishRoundNew: (data) => pub(topics.ROUND_NEW, data),
    publishRoundBetting: (data) => pub(topics.ROUND_BETTING, data),
    publishRoundStarted: (data) => pub(topics.ROUND_STARTED, data),
    publishRoundCrashed: (data) => pub(topics.ROUND_CRASHED, data),
    publishTick: (data) => pub(topics.TICK, data),
    publishBetPlaced: (data) => pub(topics.BET_PLACED, data),
    publishBetWon: (data) => pub(topics.BET_WON, data),
    publishBetLost: (data) => pub(topics.BET_LOST, data),
    publishBetRejected: (data) => pub(topics.BET_REJECTED, data),
    publishCreditFailed: (data) => pub(topics.CREDIT_FAILED, data),
  };
}

// ──── Command Listener ──────────────────────────────────────────

export interface CapturedCommand {
  subject: string;
  data: unknown;
}

export async function subscribeToCommands(
  nc: NatsConnection,
  topics: GameTopics,
): Promise<{ commands: CapturedCommand[]; close(): Promise<void> }> {
  const commands: CapturedCommand[] = [];
  const subs: Subscription[] = [];

  for (const subject of [topics.CMD_PLACE_BET, topics.CMD_CASHOUT]) {
    const sub = nc.subscribe(subject, {
      callback: (_err, msg) => {
        try {
          commands.push({ subject, data: msg.json() });
        } catch {
          // ignore malformed
        }
      },
    });
    subs.push(sub);
  }

  return {
    commands,
    async close() {
      await Promise.all(subs.map((s) => s.drain()));
    },
  };
}

// ──── Utilities ─────────────────────────────────────────────────

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
