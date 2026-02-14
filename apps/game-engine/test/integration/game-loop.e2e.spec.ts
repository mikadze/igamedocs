import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { AppModule } from '../../src/app.module';
import { VALIDATED_ENV, GAME_CONFIG } from '@config/env-config.provider';
import { NATS_CONNECTION, NATS_TOPICS } from '@messaging/tokens';
import { WALLET_GATEWAY } from '@betting/infrastructure/betting.module';
import { ProvablyFair } from '@rng/domain/ProvablyFair';
import { SeedChain } from '@rng/domain/SeedChain';
import { CrashPoint } from '@shared/kernel/CrashPoint';
import { MockNatsConnection } from './helpers/mock-nats';
import { StubWalletGateway } from './helpers/stub-wallet';
import { TEST_RAW_CONFIG, TEST_GAME_CONFIG, TEST_TOPICS, delay } from './helpers/test-config';

/**
 * P4.1 — Full Round Lifecycle E2E
 *
 * Boots a real NestJS application with all modules wired together,
 * overriding only leaf infrastructure (NATS, wallet, config).
 * Verifies the complete bet → fly → cashout → crash → settle cycle.
 */
describe('Full round lifecycle E2E (P4.1)', () => {
  let module: TestingModule;
  let mockNats: MockNatsConnection;
  let stubWallet: StubWalletGateway;

  beforeAll(async () => {
    // Control crash point for deterministic timing
    // With GROWTH_RATE 0.001 and TICK_INTERVAL_MS 10:
    //   Multiplier reaches 2.0 at ~693ms
    //   Total round: ~50ms betting + ~693ms running ≈ 750ms
    jest.spyOn(ProvablyFair, 'calculateCrashPoint').mockReturnValue(CrashPoint.of(2.0));

    mockNats = new MockNatsConnection();
    stubWallet = new StubWalletGateway();

    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(NATS_CONNECTION).useValue(mockNats)
      .overrideProvider(VALIDATED_ENV).useValue(TEST_RAW_CONFIG)
      .overrideProvider(GAME_CONFIG).useValue(TEST_GAME_CONFIG)
      .overrideProvider(NATS_TOPICS).useValue(TEST_TOPICS)
      .overrideProvider(WALLET_GATEWAY).useValue(stubWallet)
      .compile();

    // AppModule.onApplicationBootstrap() calls gameLoop.start()
    await module.init();
  }, 10_000);

  afterAll(async () => {
    jest.restoreAllMocks();
    await module?.close();
  }, 10_000);

  it('completes bet → fly → cashout → crash → settle with correct payout math', async () => {
    // 1. Wait for round.new
    const roundNew = (await mockNats.waitForMessage(TEST_TOPICS.ROUND_NEW, 5000)) as {
      roundId: string;
      hashedSeed: string;
    };
    expect(roundNew.roundId).toBeDefined();
    expect(roundNew.hashedSeed).toBeDefined();

    // 2. Wait for round.betting
    const roundBetting = (await mockNats.waitForMessage(TEST_TOPICS.ROUND_BETTING, 5000)) as {
      roundId: string;
      endsAt: number;
    };
    expect(roundBetting.roundId).toBe(roundNew.roundId);

    // 3. Place a bet via NATS command
    mockNats.injectMessage(TEST_TOPICS.CMD_PLACE_BET, {
      idempotencyKey: randomUUID(),
      playerId: 'player-1',
      roundId: roundNew.roundId,
      amountCents: 1000,
    });

    // 4. Wait for bet.placed
    const betPlaced = (await mockNats.waitForMessage(TEST_TOPICS.BET_PLACED, 5000)) as {
      betId: string;
      playerId: string;
      amountCents: number;
    };
    expect(betPlaced.playerId).toBe('player-1');
    expect(betPlaced.amountCents).toBe(1000);

    // 5. Wait for round.started (betting phase ends after 50ms)
    const roundStarted = (await mockNats.waitForMessage(TEST_TOPICS.ROUND_STARTED, 5000)) as {
      roundId: string;
    };
    expect(roundStarted.roundId).toBe(roundNew.roundId);

    // 6. Wait a bit for ticks, then cashout
    await delay(200);
    mockNats.injectMessage(TEST_TOPICS.CMD_CASHOUT, {
      playerId: 'player-1',
      roundId: roundNew.roundId,
      betId: betPlaced.betId,
    });

    // 7. Wait for bet.won
    const betWon = (await mockNats.waitForMessage(TEST_TOPICS.BET_WON, 5000)) as {
      betId: string;
      playerId: string;
      amountCents: number;
      cashoutMultiplier: number;
      payoutCents: number;
    };
    expect(betWon.betId).toBe(betPlaced.betId);
    expect(betWon.playerId).toBe('player-1');
    expect(betWon.payoutCents).toBe(Math.floor(1000 * betWon.cashoutMultiplier));

    // 8. Wait for round.crashed
    const roundCrashed = (await mockNats.waitForMessage(TEST_TOPICS.ROUND_CRASHED, 5000)) as {
      roundId: string;
      crashPoint: number;
      serverSeed: string;
    };
    expect(roundCrashed.roundId).toBe(roundNew.roundId);

    // 9. Verify provably fair: hash(serverSeed) === hashedSeed
    expect(ProvablyFair.hashServerSeed(roundCrashed.serverSeed)).toBe(roundNew.hashedSeed);

    // 10. Verify wallet calls
    expect(stubWallet.debitCalls).toHaveLength(1);
    expect(stubWallet.creditCalls).toHaveLength(1);
    expect(stubWallet.debitCalls[0].playerId).toBe('player-1');
    expect(stubWallet.debitCalls[0].amount.toCents()).toBe(1000);
  }, 5000);

  it('handles multiple bets with mixed outcomes', async () => {
    stubWallet.reset();
    mockNats.reset();

    // Wait for next round to start (after inter-round delay)
    const roundNew = (await mockNats.waitForMessage(TEST_TOPICS.ROUND_NEW, 5000)) as {
      roundId: string;
      hashedSeed: string;
    };
    await mockNats.waitForMessage(TEST_TOPICS.ROUND_BETTING, 5000);

    // Place 3 bets: auto-cashout at 1.05, manual cashout, ride to crash
    mockNats.injectMessage(TEST_TOPICS.CMD_PLACE_BET, {
      idempotencyKey: randomUUID(),
      playerId: 'auto-player',
      roundId: roundNew.roundId,
      amountCents: 1000,
      autoCashout: 1.05,
    });
    mockNats.injectMessage(TEST_TOPICS.CMD_PLACE_BET, {
      idempotencyKey: randomUUID(),
      playerId: 'manual-player',
      roundId: roundNew.roundId,
      amountCents: 2000,
    });
    mockNats.injectMessage(TEST_TOPICS.CMD_PLACE_BET, {
      idempotencyKey: randomUUID(),
      playerId: 'loser-player',
      roundId: roundNew.roundId,
      amountCents: 3000,
    });

    // Collect bet.placed events
    const placed1 = (await mockNats.waitForMessage(TEST_TOPICS.BET_PLACED, 5000)) as { betId: string; playerId: string };
    const placed2 = (await mockNats.waitForMessage(TEST_TOPICS.BET_PLACED, 5000)) as { betId: string; playerId: string };
    const placed3 = (await mockNats.waitForMessage(TEST_TOPICS.BET_PLACED, 5000)) as { betId: string; playerId: string };

    // Wait for running phase
    await mockNats.waitForMessage(TEST_TOPICS.ROUND_STARTED, 5000);

    // Find manual-player's betId
    const manualBet = [placed1, placed2, placed3].find(b => b.playerId === 'manual-player')!;

    // Wait a bit then manually cashout manual-player
    await delay(300);
    mockNats.injectMessage(TEST_TOPICS.CMD_CASHOUT, {
      playerId: 'manual-player',
      roundId: roundNew.roundId,
      betId: manualBet.betId,
    });

    // Wait for crash
    const roundCrashed = (await mockNats.waitForMessage(TEST_TOPICS.ROUND_CRASHED, 5000)) as {
      roundId: string;
    };
    expect(roundCrashed.roundId).toBe(roundNew.roundId);

    // Collect all bet.won and bet.lost events
    const wonMessages = mockNats.messagesFor(TEST_TOPICS.BET_WON) as Array<{ playerId: string }>;
    const lostMessages = mockNats.messagesFor(TEST_TOPICS.BET_LOST) as Array<{ playerId: string }>;

    // Auto-cashout player and manual player should be winners
    const wonPlayerIds = wonMessages.map(m => m.playerId);
    expect(wonPlayerIds).toContain('auto-player');
    expect(wonPlayerIds).toContain('manual-player');

    // Loser player rides to crash
    const lostPlayerIds = lostMessages.map(m => m.playerId);
    expect(lostPlayerIds).toContain('loser-player');

    // Wallet: 3 debits, 2 credits (winners only)
    expect(stubWallet.debitCalls).toHaveLength(3);
    expect(stubWallet.creditCalls).toHaveLength(2);
  }, 5000);

  it('seed chain linkage across consecutive rounds', async () => {
    mockNats.reset();

    // Capture round N
    const round1 = (await mockNats.waitForMessage(TEST_TOPICS.ROUND_NEW, 5000)) as {
      roundId: string;
      hashedSeed: string;
    };

    // Wait for crash
    const crash1 = (await mockNats.waitForMessage(TEST_TOPICS.ROUND_CRASHED, 5000)) as {
      serverSeed: string;
    };

    // Verify round 1 integrity
    expect(ProvablyFair.hashServerSeed(crash1.serverSeed)).toBe(round1.hashedSeed);

    // Capture round N+1
    const round2 = (await mockNats.waitForMessage(TEST_TOPICS.ROUND_NEW, 5000)) as {
      roundId: string;
      hashedSeed: string;
    };

    expect(round2.roundId).not.toBe(round1.roundId);
    expect(round2.hashedSeed).not.toBe(round1.hashedSeed);

    // Wait for crash
    const crash2 = (await mockNats.waitForMessage(TEST_TOPICS.ROUND_CRASHED, 5000)) as {
      serverSeed: string;
    };

    // Verify round 2 integrity
    expect(ProvablyFair.hashServerSeed(crash2.serverSeed)).toBe(round2.hashedSeed);

    // Verify chain linkage: hash(round2_seed) === round1_seed
    expect(SeedChain.verify(crash2.serverSeed, crash1.serverSeed)).toBe(true);
  }, 10_000);
});
