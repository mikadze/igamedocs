import { RunGameLoopUseCase } from '@engine/application/RunGameLoopUseCase';
import { GetRoundStateUseCase } from '@engine/application/GetRoundStateUseCase';
import { EventPublisher } from '@engine/application/ports/EventPublisher';
import { EventSubscriber } from '@engine/application/ports/EventSubscriber';
import { TickScheduler } from '@engine/application/ports/TickScheduler';
import { Timer } from '@engine/application/ports/Timer';
import { ClientSeedProvider } from '@engine/application/ports/ClientSeedProvider';
import { ServerSeedProvider } from '@engine/application/ports/ServerSeedProvider';
import { FailedEventStore } from '@engine/application/ports/FailedEventStore';
import { GameEvent } from '@engine/application/GameEvent';
import { InMemoryCurrentRoundStore } from '@engine/infrastructure/InMemoryCurrentRoundStore';
import { PlaceBetUseCase } from '@betting/application/PlaceBetUseCase';
import { CashoutUseCase } from '@betting/application/CashoutUseCase';
import { BetStore } from '@betting/application/ports/BetStore';
import { WalletGateway, WalletResult } from '@betting/application/ports/WalletGateway';
import { FailedCreditStore } from '@betting/application/ports/FailedCreditStore';
import { PlaceBetCommand } from '@betting/application/commands/PlaceBetCommand';
import { CashoutCommand } from '@betting/application/commands/CashoutCommand';
import { InMemoryBetStore } from '@betting/infrastructure/InMemoryBetStore';
import { Bet } from '@engine/domain/Bet';
import { ProvablyFair } from '@rng/domain/ProvablyFair';
import { SeedChain } from '@rng/domain/SeedChain';
import { CrashPoint } from '@shared/kernel/CrashPoint';
import { Money } from '@shared/kernel/Money';
import { Logger } from '@shared/ports/Logger';
import { flushPromises } from './helpers/test-config';

/**
 * P4.5 — Cashout Race Condition Test
 *
 * Verifies atomicity of tick processing:
 * - Cashouts queued before the crash tick succeed
 * - Cashouts after crash fail
 * - No payout exceeds amountCents * crashPoint
 */

let idempotencyCounter = 0;
function betCmd(overrides: Omit<PlaceBetCommand, 'idempotencyKey'>): PlaceBetCommand {
  return { idempotencyKey: `idem-${++idempotencyCounter}`, ...overrides };
}

describe('Cashout race condition (P4.5)', () => {
  const config = {
    houseEdgePercent: 4,
    minBetCents: 100,
    maxBetCents: 1_000_000,
    bettingWindowMs: 100,
    tickIntervalMs: 50,
  };

  let serverSeedProvider: ServerSeedProvider;
  let eventPublisher: EventPublisher;
  let eventSubscriber: EventSubscriber;
  let tickScheduler: TickScheduler;
  let timer: Timer;
  let clientSeedProvider: ClientSeedProvider;
  let betStore: BetStore;
  let walletGateway: WalletGateway;
  let placeBetUseCase: PlaceBetUseCase;
  let cashoutUseCase: CashoutUseCase;
  let currentRoundStore: InMemoryCurrentRoundStore;
  let failedCreditStore: FailedCreditStore;
  let failedEventStore: FailedEventStore;
  let logger: Logger;
  let useCase: RunGameLoopUseCase;

  let placeBetHandler: ((cmd: PlaceBetCommand) => void) | null;
  let cashoutHandler: ((cmd: CashoutCommand) => void) | null;
  let tickCallback: ((elapsedMs: number) => void) | null;
  let timerCallback: (() => void) | null;
  let immediateCallback: (() => void) | null;

  const successWalletResult: WalletResult = {
    success: true,
    transactionId: 'tx-1',
    newBalance: Money.fromCents(9000),
  };

  beforeEach(() => {
    idempotencyCounter = 0;

    // Crash at 2.0x — with default growthRate (0.00006):
    // At elapsedMs=200000 multiplier is e^12 ≈ 162754 >>> 2.0
    jest.spyOn(ProvablyFair, 'calculateCrashPoint').mockReturnValue(CrashPoint.of(2.0));

    const terminalSeed = ProvablyFair.generateServerSeed();
    const seedChain = new SeedChain(terminalSeed, 100);
    serverSeedProvider = { next: () => seedChain.next() };

    placeBetHandler = null;
    cashoutHandler = null;
    tickCallback = null;
    timerCallback = null;
    immediateCallback = null;

    eventPublisher = {
      roundNew: jest.fn(async () => {}),
      roundBetting: jest.fn(async () => {}),
      roundStarted: jest.fn(async () => {}),
      roundCrashed: jest.fn(async () => {}),
      tick: jest.fn(async () => {}),
      betPlaced: jest.fn(async () => {}),
      betWon: jest.fn(async () => {}),
      betLost: jest.fn(async () => {}),
      betRejected: jest.fn(async () => {}),
      creditFailed: jest.fn(async () => {}),
      publishBatch: jest.fn(async () => {}),
    };

    eventSubscriber = {
      onPlaceBet: jest.fn((handler) => { placeBetHandler = handler; }),
      onCashout: jest.fn((handler) => { cashoutHandler = handler; }),
      close: jest.fn(async () => {}),
    };

    tickScheduler = {
      start: jest.fn((cb) => { tickCallback = cb; }),
      stop: jest.fn(),
    };

    timer = {
      schedule: jest.fn((cb) => { timerCallback = cb; }),
      scheduleImmediate: jest.fn((cb) => { immediateCallback = cb; }),
      clear: jest.fn(),
    };

    clientSeedProvider = { next: jest.fn(() => 'client-seed') };
    betStore = new InMemoryBetStore();
    walletGateway = {
      debit: jest.fn(async () => successWalletResult),
      credit: jest.fn(async () => successWalletResult),
      getBalance: jest.fn(async () => Money.fromCents(10000)),
    };
    failedCreditStore = {
      save: jest.fn(),
      getUnresolved: jest.fn(() => []),
      markResolved: jest.fn(),
    };
    failedEventStore = { addBatch: jest.fn() };
    logger = { warn: jest.fn(), error: jest.fn() };

    placeBetUseCase = new PlaceBetUseCase(
      config, walletGateway, betStore, failedCreditStore, logger,
    );
    cashoutUseCase = new CashoutUseCase(walletGateway, failedCreditStore, eventPublisher);
    currentRoundStore = new InMemoryCurrentRoundStore();

    useCase = new RunGameLoopUseCase(
      config,
      serverSeedProvider,
      eventPublisher,
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
  });

  afterEach(() => {
    useCase.stop();
    jest.restoreAllMocks();
  });

  function flushTickEvents(): void {
    if (immediateCallback) {
      const cb = immediateCallback;
      immediateCallback = null;
      cb();
    }
  }

  function allBatchedEvents(): GameEvent[] {
    return (eventPublisher.publishBatch as jest.Mock).mock.calls.flatMap(
      ([events]: [GameEvent[]]) => events,
    );
  }

  function batchedEventsOfType<T extends GameEvent['type']>(
    type: T,
  ): Extract<GameEvent, { type: T }>[] {
    return allBatchedEvents().filter(
      (e): e is Extract<GameEvent, { type: T }> => e.type === type,
    );
  }

  /**
   * Helper: start game loop, place N bets, enter RUNNING phase.
   * Returns the roundId and betIds.
   */
  async function setupRunningRoundWithBets(
    bets: Array<{ playerId: string; amountCents: number; autoCashout?: number }>,
  ): Promise<{ roundId: string; betIds: string[] }> {
    await useCase.start();

    for (const b of bets) {
      placeBetHandler!(betCmd({
        playerId: b.playerId,
        roundId: 'any',
        amountCents: b.amountCents,
        autoCashout: b.autoCashout,
      }));
    }

    // End betting phase → RUNNING
    timerCallback!();
    await flushPromises();

    const roundId = (eventPublisher.roundNew as jest.Mock).mock.calls[0][0];
    const betIds = (eventPublisher.betPlaced as jest.Mock).mock.calls.map(
      ([snapshot]: [{ betId: string }]) => snapshot.betId,
    );

    return { roundId, betIds };
  }

  // ── Scenarios ──────────────────────────────────────────

  it('cashout queued before crash tick succeeds', async () => {
    const { roundId, betIds } = await setupRunningRoundWithBets([
      { playerId: 'player-1', amountCents: 1000 },
    ]);

    // Tick once to set a non-zero multiplier
    tickCallback!(500);
    flushTickEvents();
    await flushPromises();

    // Queue cashout
    cashoutHandler!({ playerId: 'player-1', roundId, betId: betIds[0] });

    // Fire the CRASH tick — cashout drains in step 1 before crash in step 4
    tickCallback!(200000);
    await flushPromises();

    const wonEvents = batchedEventsOfType('bet_won');
    expect(wonEvents).toHaveLength(1);
    expect(wonEvents[0].snapshot.betId).toBe(betIds[0]);
    expect(wonEvents[0].snapshot.status).toBe('WON');

    // Bet should NOT appear in lost events
    const lostEvents = batchedEventsOfType('bet_lost');
    expect(lostEvents.filter((e) => e.snapshot.betId === betIds[0])).toHaveLength(0);

    // Round DID crash
    expect(batchedEventsOfType('round_crashed')).toHaveLength(1);
  });

  it('cashout queued after crash fails (round not RUNNING)', async () => {
    const { roundId, betIds } = await setupRunningRoundWithBets([
      { playerId: 'player-1', amountCents: 1000 },
    ]);

    // Fire crash tick (no cashout queued — bet rides to crash)
    tickCallback!(200000);
    await flushPromises();

    // Clear mock call history
    (walletGateway.credit as jest.Mock).mockClear();
    (eventPublisher.publishBatch as jest.Mock).mockClear();

    // Attempt cashout AFTER crash — guard checks state !== RUNNING
    cashoutHandler!({ playerId: 'player-1', roundId, betId: betIds[0] });

    // Start next round and tick
    timerCallback!();
    await flushPromises();
    timerCallback!();
    await flushPromises();
    tickCallback!(100);
    flushTickEvents();
    await flushPromises();

    // No wallet credit for the stale cashout
    expect(walletGateway.credit).not.toHaveBeenCalled();
    expect(batchedEventsOfType('bet_won')).toHaveLength(0);
  });

  it('no payout exceeds amountCents * crashPoint', async () => {
    const crashPointValue = 2.0;
    const bets = Array.from({ length: 50 }, (_, i) => ({
      playerId: `player-${i}`,
      amountCents: 1000 + i * 100,
      // Mix: some with auto-cashout below crash, some above, some without
      autoCashout: i < 20 ? 1.0 + (i + 1) * 0.05 : undefined,
    }));

    const { roundId, betIds } = await setupRunningRoundWithBets(bets);

    // Tick a few times to trigger some auto-cashouts
    tickCallback!(500);    // multiplier ≈ e^0.03 ≈ 1.03
    flushTickEvents();
    await flushPromises();

    tickCallback!(5000);   // multiplier ≈ e^0.3 ≈ 1.35
    flushTickEvents();
    await flushPromises();

    tickCallback!(10000);  // multiplier ≈ e^0.6 ≈ 1.82
    flushTickEvents();
    await flushPromises();

    // Crash tick
    tickCallback!(200000);
    await flushPromises();

    const wonEvents = batchedEventsOfType('bet_won');
    for (const event of wonEvents) {
      const maxPayout = Math.floor(event.snapshot.amountCents * crashPointValue);
      expect(event.snapshot.payoutCents).toBeLessThanOrEqual(maxPayout);
      expect(event.snapshot.payoutCents).toBeGreaterThan(0);
    }
  });

  it('concurrent manual + auto-cashout produces single payout', async () => {
    const { roundId, betIds } = await setupRunningRoundWithBets([
      { playerId: 'player-1', amountCents: 1000, autoCashout: 1.05 },
    ]);

    // Queue manual cashout for the same bet
    cashoutHandler!({ playerId: 'player-1', roundId, betId: betIds[0] });

    // Tick where multiplier > 1.05: auto-cashout would also trigger
    // Manual cashout processes in step 1, auto-cashout check in step 3 skips (no longer ACTIVE)
    tickCallback!(1000); // multiplier ≈ e^0.06 ≈ 1.0618 > 1.05
    flushTickEvents();
    await flushPromises();

    const wonEvents = batchedEventsOfType('bet_won');
    expect(wonEvents).toHaveLength(1);

    // Wallet should be credited exactly once
    expect(walletGateway.credit).toHaveBeenCalledTimes(1);
  });

  it('50 cashouts in crash tick all succeed (processed before crash)', async () => {
    const bets = Array.from({ length: 50 }, (_, i) => ({
      playerId: `player-${i}`,
      amountCents: 1000,
    }));

    const { roundId, betIds } = await setupRunningRoundWithBets(bets);

    // Tick once so multiplier is established
    tickCallback!(500);
    flushTickEvents();
    await flushPromises();

    // Queue all 50 cashouts
    for (let i = 0; i < 50; i++) {
      cashoutHandler!({ playerId: `player-${i}`, roundId, betId: betIds[i] });
    }

    // Fire crash tick — all 50 cashouts drain in step 1, then crash in step 4
    tickCallback!(200000);
    await flushPromises();

    const wonEvents = batchedEventsOfType('bet_won');
    expect(wonEvents).toHaveLength(50);

    // No bet_lost for these bets (all cashed out before crash)
    const lostBetIds = new Set(batchedEventsOfType('bet_lost').map((e) => e.snapshot.betId));
    for (const betId of betIds) {
      expect(lostBetIds.has(betId)).toBe(false);
    }

    // Round still crashed
    expect(batchedEventsOfType('round_crashed')).toHaveLength(1);
  });

  it('no duplicate payouts — each betId appears at most once in won events', async () => {
    const { roundId, betIds } = await setupRunningRoundWithBets([
      { playerId: 'player-1', amountCents: 1000, autoCashout: 1.03 },
      { playerId: 'player-2', amountCents: 2000 },
      { playerId: 'player-3', amountCents: 3000, autoCashout: 1.05 },
    ]);

    // Queue manual cashout for player-2
    cashoutHandler!({ playerId: 'player-2', roundId, betId: betIds[1] });

    // Tick above all auto-cashout thresholds
    tickCallback!(1000);
    flushTickEvents();
    await flushPromises();

    // Fire crash tick
    tickCallback!(200000);
    await flushPromises();

    const wonEvents = batchedEventsOfType('bet_won');
    const wonBetIds = wonEvents.map((e) => e.snapshot.betId);
    const uniqueWonBetIds = new Set(wonBetIds);

    expect(wonBetIds.length).toBe(uniqueWonBetIds.size);
  });
});
