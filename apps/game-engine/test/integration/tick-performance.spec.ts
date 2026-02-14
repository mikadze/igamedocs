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
 * P4.3 — Tick Loop Performance Test
 *
 * Validates that the tick hot path can handle high bet volumes
 * within one frame budget (16ms), and that memory is properly
 * cleaned up across rounds.
 */

let idempotencyCounter = 0;
function betCmd(overrides: Omit<PlaceBetCommand, 'idempotencyKey'>): PlaceBetCommand {
  return { idempotencyKey: `idem-${++idempotencyCounter}`, ...overrides };
}

describe('Tick loop performance (P4.3)', () => {
  const config = {
    houseEdgePercent: 4,
    minBetCents: 100,
    maxBetCents: 1_000_000,
    bettingWindowMs: 100,
    tickIntervalMs: 50,
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

  let placeBetHandler: ((cmd: PlaceBetCommand) => void) | null;
  let cashoutHandler: ((cmd: CashoutCommand) => void) | null;
  let tickCallback: ((elapsedMs: number) => void) | null;
  let timerCallback: (() => void) | null;
  let immediateCallback: (() => void) | null;

  function createUseCase(crashPoint: number = 100) {
    jest.spyOn(ProvablyFair, 'calculateCrashPoint').mockReturnValue(CrashPoint.of(crashPoint));

    const terminalSeed = ProvablyFair.generateServerSeed();
    const seedChain = new SeedChain(terminalSeed, 10_000);
    const serverSeedProvider: ServerSeedProvider = { next: () => seedChain.next() };

    placeBetHandler = null;
    cashoutHandler = null;
    tickCallback = null;
    timerCallback = null;
    immediateCallback = null;

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

    return { useCase, betStore };
  }

  function flushTickEvents(): void {
    if (immediateCallback) {
      const cb = immediateCallback;
      immediateCallback = null;
      cb();
    }
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1000 bets + 100 auto-cashouts per tick completes in < 16ms', async () => {
    const { useCase } = createUseCase(100);
    await useCase.start();

    // Place 1000 bets: first 100 have autoCashout at 1.01
    for (let i = 0; i < 1000; i++) {
      placeBetHandler!(betCmd({
        playerId: `player-${i}`,
        roundId: 'any',
        amountCents: 1000,
        autoCashout: i < 100 ? 1.01 : undefined,
      }));
    }

    // End betting phase → RUNNING, places all bets
    timerCallback!();
    await flushPromises();

    // Tick at elapsedMs where multiplier > 1.01
    // multiplier = e^(0.00006 * 1000) = e^0.06 ≈ 1.0618 > 1.01
    const elapsedMs = 1000;

    // Warm up V8 JIT with a few ticks first
    tickCallback!(100);
    flushTickEvents();
    tickCallback!(200);
    flushTickEvents();

    // Measure the tick with 100 auto-cashouts
    const start = performance.now();
    tickCallback!(elapsedMs);
    flushTickEvents();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(16);
    useCase.stop();
  });

  it('empty tick (no bets) completes in < 1ms', async () => {
    const { useCase } = createUseCase(100);
    await useCase.start();

    // End betting phase → RUNNING (no bets placed)
    timerCallback!();
    await flushPromises();

    // Warm up
    tickCallback!(100);
    flushTickEvents();

    const start = performance.now();
    tickCallback!(200);
    flushTickEvents();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1);
    useCase.stop();
  });

  it('no memory leak over 1000 rounds', async () => {
    // Force GC if available (run with --expose-gc)
    const gc = (globalThis as { gc?: () => void }).gc;

    const { useCase } = createUseCase(1.0); // Instant crash

    await useCase.start();

    const heapSamples: number[] = [];
    const ROUNDS = 1000;
    const SAMPLE_INTERVAL = 100;

    for (let round = 0; round < ROUNDS; round++) {
      // Place a few bets
      for (let i = 0; i < 10; i++) {
        placeBetHandler!(betCmd({
          playerId: `player-${i}`,
          roundId: 'any',
          amountCents: 1000,
        }));
      }

      // End betting → RUNNING
      timerCallback!();
      await flushPromises();

      // Tick → instant crash (crash point is 1.0, any multiplier >= 1.0 triggers)
      tickCallback!(1);
      await flushPromises();

      // Start next round
      timerCallback!();
      await flushPromises();

      if ((round + 1) % SAMPLE_INTERVAL === 0) {
        if (gc) gc();
        heapSamples.push(process.memoryUsage().heapUsed);
      }
    }

    useCase.stop();

    // Verify no monotonic heap growth.
    // Compare first half average to second half average.
    // Allow up to 50% growth as tolerance.
    expect(heapSamples.length).toBeGreaterThanOrEqual(4);

    const mid = Math.floor(heapSamples.length / 2);
    const firstHalf = heapSamples.slice(0, mid);
    const secondHalf = heapSamples.slice(mid);

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const firstAvg = avg(firstHalf);
    const secondAvg = avg(secondHalf);

    // Second half should not be more than 50% larger than first half
    expect(secondAvg).toBeLessThan(firstAvg * 1.5);
  }, 30_000);
});
