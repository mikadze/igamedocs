import { performance } from 'perf_hooks';
import { RunGameLoopUseCase } from '@engine/application/RunGameLoopUseCase';
import { EventPublisher } from '@engine/application/ports/EventPublisher';
import { EventSubscriber } from '@engine/application/ports/EventSubscriber';
import { TickScheduler } from '@engine/application/ports/TickScheduler';
import { Timer } from '@engine/application/ports/Timer';
import { ClientSeedProvider } from '@engine/application/ports/ClientSeedProvider';
import { ServerSeedProvider } from '@engine/application/ports/ServerSeedProvider';
import { FailedEventStore } from '@engine/application/ports/FailedEventStore';
import { InMemoryCurrentRoundStore } from '@engine/infrastructure/InMemoryCurrentRoundStore';
import { PlaceBetUseCase } from '@betting/application/PlaceBetUseCase';
import { CashoutUseCase } from '@betting/application/CashoutUseCase';
import { InMemoryBetStore } from '@betting/infrastructure/InMemoryBetStore';
import { PlaceBetCommand } from '@betting/application/commands/PlaceBetCommand';
import { CashoutCommand } from '@betting/application/commands/CashoutCommand';
import { ProvablyFair } from '@rng/domain/ProvablyFair';
import { SeedChain } from '@rng/domain/SeedChain';
import { CrashPoint } from '@shared/kernel/CrashPoint';
import { Money } from '@shared/kernel/Money';
import { Logger } from '@shared/ports/Logger';
import { WalletGateway, WalletResult } from '@betting/application/ports/WalletGateway';
import { FailedCreditStore } from '@betting/application/ports/FailedCreditStore';
import { flushPromises } from './helpers/test-config';

/**
 * Load Tests — Sustained Performance Profiling
 *
 * Measures tick latency distribution (p50/p95/p99), CPU cost per tick,
 * and memory growth patterns over thousands of rounds.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function avg(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

let idempotencyCounter = 0;
function betCmd(overrides: Omit<PlaceBetCommand, 'idempotencyKey'>): PlaceBetCommand {
  return { idempotencyKey: `load-${++idempotencyCounter}`, ...overrides };
}

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

interface TestHarness {
  useCase: RunGameLoopUseCase;
  betStore: InMemoryBetStore;
  placeBet: (cmd: PlaceBetCommand) => void;
  cashout: (cmd: CashoutCommand) => void;
  tick: (elapsedMs: number) => void;
  fireTimer: () => void;
  flushTickEvents: () => void;
}

describe('Load tests (sustained performance)', () => {
  const config = {
    houseEdgePercent: 4,
    minBetCents: 100,
    maxBetCents: 1_000_000,
    bettingWindowMs: 100,
    tickIntervalMs: 50,
    growthRate: 0.00006,
  };

  const noopPublisher: EventPublisher = {
    roundNew: async () => {},
    roundBetting: async () => {},
    roundStarted: async () => {},
    roundCrashed: async () => {},
    tick: async () => {},
    betPlaced: async () => {},
    betWon: async () => {},
    betLost: async () => {},
    betRejected: async () => {},
    creditFailed: async () => {},
    publishBatch: async () => {},
  };

  const successResult: WalletResult = {
    success: true,
    transactionId: 'tx-1',
    newBalance: Money.fromCents(9000),
  };

  function createUseCase(crashPoint: number = 100): TestHarness {
    jest.spyOn(ProvablyFair, 'calculateCrashPoint').mockReturnValue(CrashPoint.of(crashPoint));

    const terminalSeed = ProvablyFair.generateServerSeed();
    const seedChain = new SeedChain(terminalSeed, 10_000);
    const serverSeedProvider: ServerSeedProvider = { next: () => seedChain.next() };

    let placeBetHandler: ((cmd: PlaceBetCommand) => void) | null = null;
    let cashoutHandler: ((cmd: CashoutCommand) => void) | null = null;
    let tickCallback: ((elapsedMs: number) => void) | null = null;
    let timerCallback: (() => void) | null = null;
    let immediateCallback: (() => void) | null = null;

    const eventSubscriber: EventSubscriber = {
      onPlaceBet: (handler) => { placeBetHandler = handler; },
      onCashout: (handler) => { cashoutHandler = handler; },
      close: async () => {},
    };

    const tickScheduler: TickScheduler = {
      start: (cb) => { tickCallback = cb; },
      stop: () => {},
    };

    const timer: Timer = {
      schedule: (cb) => { timerCallback = cb; },
      scheduleImmediate: (cb) => { immediateCallback = cb; },
      clear: () => {},
    };

    const clientSeedProvider: ClientSeedProvider = { next: () => 'client-seed' };
    const betStore = new InMemoryBetStore();
    const walletGateway: WalletGateway = {
      debit: async () => successResult,
      credit: async () => successResult,
      getBalance: async () => Money.fromCents(10000),
    };
    const failedCreditStore: FailedCreditStore = {
      save: () => {},
      getUnresolved: () => [],
      markResolved: () => {},
    };
    const failedEventStore: FailedEventStore = { addBatch: () => {} };
    const logger: Logger = { warn: () => {}, error: () => {} };

    const placeBetUseCase = new PlaceBetUseCase(
      config, walletGateway, betStore, failedCreditStore, logger,
    );
    const cashoutUseCase = new CashoutUseCase(walletGateway, failedCreditStore, noopPublisher);
    const currentRoundStore = new InMemoryCurrentRoundStore();

    const useCase = new RunGameLoopUseCase(
      config,
      serverSeedProvider,
      noopPublisher,
      eventSubscriber,
      tickScheduler,
      timer,
      placeBetUseCase,
      cashoutUseCase,
      currentRoundStore,
      clientSeedProvider,
      logger,
      failedEventStore,
      betStore,
    );

    return {
      useCase,
      betStore,
      placeBet: (cmd) => placeBetHandler!(cmd),
      cashout: (cmd) => cashoutHandler!(cmd),
      tick: (elapsedMs) => tickCallback!(elapsedMs),
      fireTimer: () => timerCallback!(),
      flushTickEvents: () => {
        if (immediateCallback) {
          const cb = immediateCallback;
          immediateCallback = null;
          cb();
        }
      },
    };
  }

  async function runSingleRound(
    harness: TestHarness,
    betCount: number,
    autoCashoutPercent: number = 0.1,
  ): Promise<void> {
    for (let i = 0; i < betCount; i++) {
      harness.placeBet(betCmd({
        playerId: `player-${i}`,
        roundId: 'any',
        amountCents: 1000,
        autoCashout: i < betCount * autoCashoutPercent ? 1.01 : undefined,
      }));
    }

    // End betting -> RUNNING
    harness.fireTimer();
    await flushPromises();

    // Single tick -> crash (crash point 1.0, multiplier >= 1.0 at any elapsedMs)
    harness.tick(1);
    await flushPromises();

    // Start next round
    harness.fireTimer();
    await flushPromises();
  }

  async function warmup(harness: TestHarness, rounds: number = 50): Promise<void> {
    for (let i = 0; i < rounds; i++) {
      await runSingleRound(harness, 10);
    }
  }

  beforeEach(() => {
    idempotencyCounter = 0;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Test 1: Tick latency distribution across load profiles
  // -------------------------------------------------------------------------

  it('tick latency p99 within budget across load profiles', async () => {
    const profiles = [
      { label: 'light',  bets: 10,  p99Max: 2 },
      { label: 'medium', bets: 100, p99Max: 5 },
      { label: 'heavy',  bets: 500, p99Max: 16 },
    ];

    for (const profile of profiles) {
      const harness = createUseCase(1.0);
      await harness.useCase.start();
      await warmup(harness, 50);

      const samples: number[] = [];
      const ROUNDS = 200;

      for (let r = 0; r < ROUNDS; r++) {
        // Place bets
        for (let i = 0; i < profile.bets; i++) {
          harness.placeBet(betCmd({
            playerId: `player-${i}`,
            roundId: 'any',
            amountCents: 1000,
            autoCashout: i < profile.bets * 0.1 ? 1.01 : undefined,
          }));
        }

        // End betting -> RUNNING
        harness.fireTimer();
        await flushPromises();

        // Measure the crash tick
        const start = performance.now();
        harness.tick(1);
        harness.flushTickEvents();
        const elapsed = performance.now() - start;
        samples.push(elapsed);

        await flushPromises();

        // Start next round
        harness.fireTimer();
        await flushPromises();
      }

      harness.useCase.stop();

      const sorted = [...samples].sort((a, b) => a - b);
      const p50 = percentile(sorted, 50);
      const p95 = percentile(sorted, 95);
      const p99 = percentile(sorted, 99);

      // eslint-disable-next-line no-console
      console.log(
        `[${profile.label}] ${profile.bets} bets — ` +
        `p50=${p50.toFixed(3)}ms, p95=${p95.toFixed(3)}ms, p99=${p99.toFixed(3)}ms`,
      );

      expect(p99).toBeLessThan(profile.p99Max);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // Test 2: Tick latency does not drift upward over 2000 ticks
  // -------------------------------------------------------------------------

  it('tick latency does not drift over 2000 ticks in a single round', async () => {
    const harness = createUseCase(1_000_000); // Never crashes during test
    await harness.useCase.start();

    // Place 200 bets (none with auto-cashout that would trigger)
    for (let i = 0; i < 200; i++) {
      harness.placeBet(betCmd({
        playerId: `player-${i}`,
        roundId: 'any',
        amountCents: 1000,
      }));
    }

    // End betting -> RUNNING
    harness.fireTimer();
    await flushPromises();

    // Warmup ticks
    for (let i = 0; i < 100; i++) {
      harness.tick(i + 1);
      harness.flushTickEvents();
    }
    await flushPromises();

    const TICKS = 2000;
    const samples: number[] = [];

    for (let i = 0; i < TICKS; i++) {
      const elapsedMs = 100 + (i + 1) * 50; // Start after warmup offset
      const start = performance.now();
      harness.tick(elapsedMs);
      harness.flushTickEvents();
      const elapsed = performance.now() - start;
      samples.push(elapsed);

      // Drain microtask queue periodically to prevent PromiseTracker buildup
      if ((i + 1) % 100 === 0) {
        await flushPromises();
      }
    }

    harness.useCase.stop();

    const q1 = samples.slice(0, 500);
    const q4 = samples.slice(1500);
    const q1Avg = avg(q1);
    const q4Avg = avg(q4);

    // eslint-disable-next-line no-console
    console.log(
      `[drift] Q1 avg=${q1Avg.toFixed(4)}ms, Q4 avg=${q4Avg.toFixed(4)}ms, ` +
      `ratio=${(q4Avg / q1Avg).toFixed(2)}x`,
    );

    expect(q4Avg).toBeLessThan(q1Avg * 2.0);
    expect(q4Avg).toBeLessThan(5);
  }, 30_000);

  // -------------------------------------------------------------------------
  // Test 3: CPU usage per tick is bounded
  // -------------------------------------------------------------------------

  it('CPU usage per tick is bounded', async () => {
    const harness = createUseCase(1.0);
    await harness.useCase.start();
    await warmup(harness, 50);

    const ROUNDS = 500;
    const BETS_PER_ROUND = 100;
    let tickCount = 0;

    const cpuBefore = process.cpuUsage();

    for (let r = 0; r < ROUNDS; r++) {
      for (let i = 0; i < BETS_PER_ROUND; i++) {
        harness.placeBet(betCmd({
          playerId: `player-${i}`,
          roundId: 'any',
          amountCents: 1000,
          autoCashout: i < 10 ? 1.01 : undefined,
        }));
      }

      harness.fireTimer();
      await flushPromises();

      harness.tick(1);
      harness.flushTickEvents();
      tickCount++;

      await flushPromises();
      harness.fireTimer();
      await flushPromises();
    }

    const cpuAfter = process.cpuUsage(cpuBefore);
    const userPerTick = cpuAfter.user / tickCount;
    const systemPerTick = cpuAfter.system / tickCount;
    const totalPerTick = userPerTick + systemPerTick;

    harness.useCase.stop();

    // eslint-disable-next-line no-console
    console.log(
      `[cpu] ${BETS_PER_ROUND} bets — ` +
      `user=${userPerTick.toFixed(0)}us, system=${systemPerTick.toFixed(0)}us, ` +
      `total=${totalPerTick.toFixed(0)}us`,
    );

    // Total CPU per tick should be well under 16ms frame budget (16000us)
    expect(totalPerTick).toBeLessThan(16_000);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Test 4: Memory growth bounded over 2000 rounds
  // -------------------------------------------------------------------------

  it('memory growth bounded over 2000 rounds', async () => {
    const gc = (globalThis as { gc?: () => void }).gc;

    const harness = createUseCase(1.0);
    await harness.useCase.start();

    const ROUNDS = 2000;
    const BETS_PER_ROUND = 50;
    const SAMPLE_INTERVAL = 50;

    interface MemorySample {
      round: number;
      heapUsed: number;
      external: number;
    }

    const samples: MemorySample[] = [];

    for (let r = 0; r < ROUNDS; r++) {
      await runSingleRound(harness, BETS_PER_ROUND);

      if ((r + 1) % SAMPLE_INTERVAL === 0) {
        if (gc) gc();
        const mem = process.memoryUsage();
        samples.push({
          round: r + 1,
          heapUsed: mem.heapUsed,
          external: mem.external,
        });
      }
    }

    harness.useCase.stop();

    // Quarter-based heap analysis
    const quarter = Math.floor(samples.length / 4);
    const q1Heap = avg(samples.slice(0, quarter).map((s) => s.heapUsed));
    const q4Heap = avg(samples.slice(3 * quarter).map((s) => s.heapUsed));

    // eslint-disable-next-line no-console
    console.log(
      `[memory] Q1 heap=${(q1Heap / 1024 / 1024).toFixed(1)}MB, ` +
      `Q4 heap=${(q4Heap / 1024 / 1024).toFixed(1)}MB, ` +
      `ratio=${(q4Heap / q1Heap).toFixed(2)}x ` +
      `(${samples.length} samples, gc=${gc ? 'yes' : 'no'})`,
    );

    // Q4 heap should not exceed Q1 by more than 30%
    expect(q4Heap).toBeLessThan(q1Heap * 1.3);

    // No monotonic heap growth in last half (only meaningful with forced GC)
    if (gc) {
      const lastHalf = samples.slice(Math.floor(samples.length / 2));
      let growthCount = 0;
      for (let i = 1; i < lastHalf.length; i++) {
        if (lastHalf[i].heapUsed > lastHalf[i - 1].heapUsed) growthCount++;
      }
      expect(growthCount / (lastHalf.length - 1)).toBeLessThan(0.8);
    }

    // External memory should be stable
    const q1External = avg(samples.slice(0, quarter).map((s) => s.external));
    const q4External = avg(samples.slice(3 * quarter).map((s) => s.external));
    if (q1External > 0) {
      expect(q4External).toBeLessThan(q1External * 1.5);
    }
  }, 90_000);
});
