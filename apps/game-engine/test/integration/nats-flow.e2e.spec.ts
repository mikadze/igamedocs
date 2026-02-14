import { Test, TestingModule } from '@nestjs/testing';
import { ChildProcess, spawn, execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { connect, NatsConnection, StringCodec } from 'nats';
import { AppModule } from '../../src/app.module';
import { VALIDATED_ENV, GAME_CONFIG } from '@config/env-config.provider';
import { NATS_TOPICS } from '@messaging/tokens';
import { WALLET_GATEWAY } from '@betting/infrastructure/betting.module';
import { ProvablyFair } from '@rng/domain/ProvablyFair';
import { CrashPoint } from '@shared/kernel/CrashPoint';
import { StubWalletGateway } from './helpers/stub-wallet';
import { TEST_RAW_CONFIG, TEST_GAME_CONFIG, TEST_TOPICS, delay } from './helpers/test-config';

/**
 * P4.2 — NATS Message Flow Test
 *
 * Uses a real nats-server process for true end-to-end NATS message
 * flow verification. Skipped when nats-server is not in PATH.
 */

function isNatsServerAvailable(): boolean {
  try {
    execSync('which nats-server', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getRandomPort(): number {
  return 10_000 + Math.floor(Math.random() * 50_000);
}

async function waitForNatsReady(port: number, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const nc = await connect({ servers: `nats://127.0.0.1:${port}`, timeout: 500 });
      await nc.close();
      return;
    } catch {
      await delay(100);
    }
  }
  throw new Error(`NATS server not ready on port ${port} after ${timeoutMs}ms`);
}

/**
 * Helper: subscribe to a NATS subject and collect messages.
 */
function collectMessages(nc: NatsConnection, subject: string): { messages: unknown[]; stop: () => void } {
  const messages: unknown[] = [];
  const sub = nc.subscribe(subject, {
    callback: (_err, msg) => {
      try {
        messages.push(JSON.parse(new TextDecoder().decode(msg.data)));
      } catch { /* ignore parse errors */ }
    },
  });
  return { messages, stop: () => sub.unsubscribe() };
}

/**
 * Helper: wait until at least `count` messages on the collector.
 */
async function waitForMessages(
  collector: { messages: unknown[] },
  count: number,
  timeoutMs = 5000,
): Promise<unknown[]> {
  const start = Date.now();
  while (collector.messages.length < count) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Timeout: expected ${count} messages, got ${collector.messages.length} after ${timeoutMs}ms`,
      );
    }
    await delay(50);
  }
  return collector.messages.slice(0, count);
}

const SKIP_REASON = 'nats-server not found in PATH — skipping NATS flow tests';
const available = isNatsServerAvailable();

(available ? describe : describe.skip)('NATS message flow E2E (P4.2)', () => {
  let natsProcess: ChildProcess;
  let natsPort: number;
  let module: TestingModule;
  let testClient: NatsConnection;
  let stubWallet: StubWalletGateway;

  beforeAll(async () => {
    if (!available) return;

    jest.spyOn(ProvablyFair, 'calculateCrashPoint').mockReturnValue(CrashPoint.of(2.0));

    natsPort = getRandomPort();
    natsProcess = spawn('nats-server', ['-p', String(natsPort)], {
      stdio: 'ignore',
      detached: false,
    });

    await waitForNatsReady(natsPort);

    // Set env for the real nats-connection.provider
    process.env.NATS_URL = `nats://127.0.0.1:${natsPort}`;

    stubWallet = new StubWalletGateway();

    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VALIDATED_ENV).useValue(TEST_RAW_CONFIG)
      .overrideProvider(GAME_CONFIG).useValue(TEST_GAME_CONFIG)
      .overrideProvider(NATS_TOPICS).useValue(TEST_TOPICS)
      .overrideProvider(WALLET_GATEWAY).useValue(stubWallet)
      .compile();

    // Separate NATS client for test assertions
    testClient = await connect({ servers: `nats://127.0.0.1:${natsPort}` });

    await module.init();
  }, 15_000);

  afterAll(async () => {
    jest.restoreAllMocks();
    if (testClient && !testClient.isClosed()) {
      await testClient.drain();
    }
    if (module) {
      await module.close();
    }
    if (natsProcess) {
      natsProcess.kill('SIGTERM');
    }
    delete process.env.NATS_URL;
  }, 15_000);

  if (!available) {
    it(SKIP_REASON, () => {});
    return;
  }

  it('place-bet command produces bet.placed event with correct schema', async () => {
    const betPlacedCollector = collectMessages(testClient, TEST_TOPICS.BET_PLACED);
    const roundNewCollector = collectMessages(testClient, TEST_TOPICS.ROUND_NEW);

    // Wait for round to start
    const [roundNew] = await waitForMessages(roundNewCollector, 1) as [{ roundId: string }];
    expect(roundNew.roundId).toBeDefined();

    // Publish place-bet command
    const sc = StringCodec();
    testClient.publish(TEST_TOPICS.CMD_PLACE_BET, sc.encode(JSON.stringify({
      idempotencyKey: randomUUID(),
      playerId: 'nats-player-1',
      roundId: roundNew.roundId,
      amountCents: 500,
    })));

    // Wait for bet.placed
    const [betPlaced] = await waitForMessages(betPlacedCollector, 1) as [Record<string, unknown>];
    expect(typeof betPlaced.betId).toBe('string');
    expect(betPlaced.playerId).toBe('nats-player-1');
    expect(betPlaced.amountCents).toBe(500);
    expect(typeof betPlaced.status).toBe('string');

    betPlacedCollector.stop();
    roundNewCollector.stop();
  }, 10_000);

  it('round lifecycle event sequence is correct', async () => {
    // Subscribe to all round lifecycle topics
    const roundNewCollector = collectMessages(testClient, TEST_TOPICS.ROUND_NEW);
    const roundBettingCollector = collectMessages(testClient, TEST_TOPICS.ROUND_BETTING);
    const roundStartedCollector = collectMessages(testClient, TEST_TOPICS.ROUND_STARTED);
    const tickCollector = collectMessages(testClient, TEST_TOPICS.TICK);
    const roundCrashedCollector = collectMessages(testClient, TEST_TOPICS.ROUND_CRASHED);

    // Wait for a full round lifecycle
    await waitForMessages(roundNewCollector, 1);
    await waitForMessages(roundBettingCollector, 1);
    await waitForMessages(roundStartedCollector, 1);
    await waitForMessages(tickCollector, 1);
    await waitForMessages(roundCrashedCollector, 1);

    // Verify we got at least one of each
    expect(roundNewCollector.messages.length).toBeGreaterThanOrEqual(1);
    expect(roundBettingCollector.messages.length).toBeGreaterThanOrEqual(1);
    expect(roundStartedCollector.messages.length).toBeGreaterThanOrEqual(1);
    expect(tickCollector.messages.length).toBeGreaterThanOrEqual(1);
    expect(roundCrashedCollector.messages.length).toBeGreaterThanOrEqual(1);

    // Verify tick payload shape
    const tick = tickCollector.messages[0] as Record<string, unknown>;
    expect(typeof tick.roundId).toBe('string');
    expect(typeof tick.multiplier).toBe('number');
    expect(typeof tick.elapsedMs).toBe('number');

    // Verify round.crashed payload shape
    const crashed = roundCrashedCollector.messages[0] as Record<string, unknown>;
    expect(typeof crashed.roundId).toBe('string');
    expect(typeof crashed.crashPoint).toBe('number');
    expect((crashed.crashPoint as number)).toBeGreaterThanOrEqual(1.0);
    expect(typeof crashed.serverSeed).toBe('string');

    roundNewCollector.stop();
    roundBettingCollector.stop();
    roundStartedCollector.stop();
    tickCollector.stop();
    roundCrashedCollector.stop();
  }, 10_000);

  it('malformed command does not crash the engine', async () => {
    const betPlacedCollector = collectMessages(testClient, TEST_TOPICS.BET_PLACED);
    const tickCollector = collectMessages(testClient, TEST_TOPICS.TICK);

    // Wait for a round to be in betting phase
    const roundNewCollector = collectMessages(testClient, TEST_TOPICS.ROUND_NEW);
    await waitForMessages(roundNewCollector, 1);

    // Send malformed payload (negative amountCents, missing fields)
    const sc = StringCodec();
    testClient.publish(TEST_TOPICS.CMD_PLACE_BET, sc.encode(JSON.stringify({
      idempotencyKey: 'not-a-uuid',
      playerId: '',
      roundId: '',
      amountCents: -100,
    })));

    // Wait a bit — no bet.placed should appear
    await delay(500);
    expect(betPlacedCollector.messages).toHaveLength(0);

    // Engine should still be running — tick events continue
    await waitForMessages(tickCollector, 1, 5000);
    expect(tickCollector.messages.length).toBeGreaterThanOrEqual(1);

    betPlacedCollector.stop();
    tickCollector.stop();
    roundNewCollector.stop();
  }, 10_000);
});
