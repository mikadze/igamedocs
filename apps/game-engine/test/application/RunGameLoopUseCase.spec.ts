import { RunGameLoopUseCase } from '@engine/application/RunGameLoopUseCase';
import { GetRoundStateUseCase } from '@engine/application/GetRoundStateUseCase';
import { CurrentRoundStore } from '@engine/application/ports/CurrentRoundStore';
import { InMemoryCurrentRoundStore } from '@engine/infrastructure/InMemoryCurrentRoundStore';
import { EventPublisher } from '@engine/application/ports/EventPublisher';
import { EventSubscriber } from '@engine/application/ports/EventSubscriber';
import { TickScheduler } from '@engine/application/ports/TickScheduler';
import { Timer } from '@engine/application/ports/Timer';
import { ClientSeedProvider } from '@engine/application/ports/ClientSeedProvider';
import { PlaceBetUseCase } from '@betting/application/PlaceBetUseCase';
import { CashoutUseCase } from '@betting/application/CashoutUseCase';
import { BetStore } from '@betting/application/ports/BetStore';
import { WalletGateway, WalletResult } from '@betting/application/ports/WalletGateway';
import { PlaceBetCommand } from '@betting/application/commands/PlaceBetCommand';
import { CashoutCommand } from '@betting/application/commands/CashoutCommand';
import { Bet } from '@engine/domain/Bet';
import { GameConfig } from '@shared/kernel/GameConfig';
import { SeedChain } from '@rng/domain/SeedChain';
import { ProvablyFair } from '@rng/domain/ProvablyFair';
import { Money } from '@shared/kernel/Money';
import { RoundState } from '@engine/domain/RoundState';
import { Logger } from '@shared/ports/Logger';
import { FailedCreditStore } from '@betting/application/ports/FailedCreditStore';
import { FailedEventStore } from '@engine/application/ports/FailedEventStore';
import { GameEvent } from '@engine/application/GameEvent';
import { CrashPoint } from '@shared/kernel/CrashPoint';

describe('RunGameLoopUseCase', () => {
  const config: GameConfig = {
    houseEdgePercent: 4,
    minBetCents: 100,
    maxBetCents: 1000000,
    bettingWindowMs: 100,
    tickIntervalMs: 50,
  };

  let seedChain: SeedChain;
  let eventPublisher: EventPublisher;
  let eventSubscriber: EventSubscriber;
  let tickScheduler: TickScheduler;
  let timer: Timer;
  let clientSeedProvider: ClientSeedProvider;
  let betStore: BetStore;
  let walletGateway: WalletGateway;
  let placeBetUseCase: PlaceBetUseCase;
  let cashoutUseCase: CashoutUseCase;
  let currentRoundStore: CurrentRoundStore;
  let getRoundStateUseCase: GetRoundStateUseCase;
  let failedCreditStore: FailedCreditStore;
  let failedEventStore: FailedEventStore;
  let logger: Logger;
  let useCase: RunGameLoopUseCase;

  // Capture handlers registered via EventSubscriber
  let placeBetHandler: ((cmd: PlaceBetCommand) => void) | null;
  let cashoutHandler: ((cmd: CashoutCommand) => void) | null;

  // Capture tick callback registered via TickScheduler
  let tickCallback: ((elapsedMs: number) => void) | null;

  // Capture one-shot timer callback registered via Timer
  let timerCallback: (() => void) | null;

  // Capture scheduleImmediate callback for flush
  let immediateCallback: (() => void) | null;

  const successWalletResult: WalletResult = {
    success: true,
    transactionId: 'tx-1',
    newBalance: Money.fromCents(9000),
  };

  let storedBets: Map<string, Bet>;

  beforeEach(() => {
    // Default to a high crash point so tests that don't test crash behavior
    // aren't affected by random low crash points (~4% chance of instant crash).
    // Tests that need crashes use tickCallback!(200000) where multiplier ≈ 162754 >>> 100.
    jest.spyOn(ProvablyFair, 'calculateCrashPoint').mockReturnValue(CrashPoint.of(100));

    const terminalSeed = ProvablyFair.generateServerSeed();
    seedChain = new SeedChain(terminalSeed, 100);

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
      onPlaceBet: jest.fn((handler) => {
        placeBetHandler = handler;
      }),
      onCashout: jest.fn((handler) => {
        cashoutHandler = handler;
      }),
      close: jest.fn(async () => {}),
    };

    tickScheduler = {
      start: jest.fn((cb) => {
        tickCallback = cb;
      }),
      stop: jest.fn(),
    };

    timer = {
      schedule: jest.fn((cb) => {
        timerCallback = cb;
      }),
      scheduleImmediate: jest.fn((cb) => {
        immediateCallback = cb;
      }),
      clear: jest.fn(),
    };

    clientSeedProvider = {
      next: jest.fn(() => 'default-client-seed'),
    };

    storedBets = new Map();
    betStore = {
      add: jest.fn((bet: Bet) => storedBets.set(bet.id, bet)),
      getById: jest.fn((id: string) => storedBets.get(id)),
      getByRound: jest.fn(() => Array.from(storedBets.values())),
      getActiveByRound: jest.fn(() => []),
    };

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
    failedEventStore = {
      addBatch: jest.fn(),
    };
    logger = { warn: jest.fn(), error: jest.fn() };
    placeBetUseCase = new PlaceBetUseCase(
      config,
      walletGateway,
      betStore,
      failedCreditStore,
      logger,
    );
    cashoutUseCase = new CashoutUseCase(walletGateway, failedCreditStore, eventPublisher);
    currentRoundStore = new InMemoryCurrentRoundStore();
    getRoundStateUseCase = new GetRoundStateUseCase(currentRoundStore);

    useCase = new RunGameLoopUseCase(
      config,
      seedChain,
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
    );
  });

  afterEach(() => {
    useCase.stop();
    jest.restoreAllMocks();
  });

  // --- Test helpers ---

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
    return allBatchedEvents().filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
  }

  describe('start and stop', () => {
    it('registers event handlers on start', async () => {
      await useCase.start();

      expect(eventSubscriber.onPlaceBet).toHaveBeenCalledTimes(1);
      expect(eventSubscriber.onCashout).toHaveBeenCalledTimes(1);
      expect(placeBetHandler).toBeTruthy();
      expect(cashoutHandler).toBeTruthy();
    });

    it('emits roundNew and roundBetting on start', async () => {
      await useCase.start();

      expect(eventPublisher.roundNew).toHaveBeenCalledTimes(1);
      expect(eventPublisher.roundBetting).toHaveBeenCalledTimes(1);
    });

    it('stops tick scheduler on stop', async () => {
      await useCase.start();
      useCase.stop();

      expect(tickScheduler.stop).toHaveBeenCalled();
    });

    it('throws when start() is called twice', async () => {
      await useCase.start();
      await expect(useCase.start()).rejects.toThrow('Game loop is already running');
    });
  });

  describe('round lifecycle', () => {
    it('transitions from BETTING to RUNNING after betting window', async () => {
      await useCase.start();

      // Fire betting window timer
      timerCallback!();
      await flushPromises();

      expect(eventPublisher.roundStarted).toHaveBeenCalledTimes(1);
      expect(tickScheduler.start).toHaveBeenCalledTimes(1);
    });

    it('provides round state via GetRoundStateUseCase', async () => {
      await useCase.start();

      const snapshot = getRoundStateUseCase.execute();
      expect(snapshot).not.toBeNull();
      expect(snapshot!.state).toBe(RoundState.BETTING);
      expect(snapshot!.hashedSeed).toBeDefined();
    });

    it('clears round state on stop', async () => {
      await useCase.start();
      useCase.stop();

      const snapshot = getRoundStateUseCase.execute();
      expect(snapshot).toBeNull();
    });
  });

  describe('bet placement during betting phase', () => {
    it('processes queued bets when betting phase ends', async () => {
      await useCase.start();

      // Simulate placing a bet via EventSubscriber
      placeBetHandler!({
        playerId: 'player-1',
        roundId: 'any',
        amountCents: 1000,
      });

      // Fire betting window timer
      timerCallback!();
      await flushPromises();

      expect(eventPublisher.betPlaced).toHaveBeenCalledTimes(1);
      expect(eventPublisher.betPlaced).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 'player-1',
          amountCents: 1000,
        }),
      );
    });

    it('emits betRejected when bet placement fails', async () => {
      await useCase.start();

      // Place a bet below minimum (config.minBetCents = 100)
      placeBetHandler!({
        playerId: 'player-1',
        roundId: 'any',
        amountCents: 10,
      });

      timerCallback!();
      await flushPromises();

      expect(eventPublisher.betRejected).toHaveBeenCalledWith(
        'player-1',
        expect.any(String),
        10,
        'BELOW_MIN_BET',
      );
      expect(eventPublisher.betPlaced).not.toHaveBeenCalled();
      // Round still proceeds to RUNNING
      expect(eventPublisher.roundStarted).toHaveBeenCalledTimes(1);
    });
  });

  describe('tick processing', () => {
    it('emits tick events during running phase via publishBatch', async () => {
      await useCase.start();
      timerCallback!();
      await flushPromises();

      // Simulate a tick at 100ms (multiplier ~1.006)
      tickCallback!(100);
      flushTickEvents();
      await flushPromises();

      expect(batchedEventsOfType('tick')).toEqual([
        expect.objectContaining({
          roundId: expect.any(String),
          multiplier: expect.any(Number),
          elapsedMs: 100,
        }),
      ]);
    });

    it('processes cashouts during tick', async () => {
      await useCase.start();

      // Place a bet during betting phase
      placeBetHandler!({
        playerId: 'player-1',
        roundId: 'any',
        amountCents: 1000,
      });

      timerCallback!();
      await flushPromises();

      // Find the bet ID and round ID
      const roundId = (eventPublisher.roundNew as jest.Mock).mock.calls[0][0];
      const betId = Array.from(storedBets.keys())[0];

      // Tick to set a multiplier
      tickCallback!(500);
      flushTickEvents();
      await flushPromises();

      // Queue a cashout command
      cashoutHandler!({ playerId: 'player-1', roundId, betId });

      // Next tick processes the cashout
      tickCallback!(600);
      flushTickEvents();
      await flushPromises();

      expect(walletGateway.credit).toHaveBeenCalled();
      expect(batchedEventsOfType('bet_won')).toEqual([
        expect.objectContaining({ snapshot: expect.objectContaining({ betId }) }),
      ]);
    });

    it('processes auto-cashouts at correct multiplier', async () => {
      await useCase.start();

      // Place a bet with auto-cashout at 1.05
      placeBetHandler!({
        playerId: 'player-1',
        roundId: 'any',
        amountCents: 1000,
        autoCashout: 1.05,
      });

      timerCallback!();
      await flushPromises();

      // Tick at time when multiplier is well above 1.05
      // Multiplier.at(1000) = e^(0.00006*1000) = e^0.06 ≈ 1.0618
      tickCallback!(1000);
      flushTickEvents();
      await flushPromises();

      expect(batchedEventsOfType('bet_won')).toHaveLength(1);
      expect(walletGateway.credit).toHaveBeenCalled();
    });

    it('processes multiple auto-cashouts in the same tick', async () => {
      await useCase.start();

      placeBetHandler!({
        playerId: 'player-1',
        roundId: 'any',
        amountCents: 1000,
        autoCashout: 1.01,
      });
      placeBetHandler!({
        playerId: 'player-2',
        roundId: 'any',
        amountCents: 2000,
        autoCashout: 1.02,
      });
      placeBetHandler!({
        playerId: 'player-3',
        roundId: 'any',
        amountCents: 3000,
        autoCashout: 1.03,
      });

      timerCallback!();
      await flushPromises();

      expect(eventPublisher.betPlaced).toHaveBeenCalledTimes(3);

      // Multiplier.valueAt(1000) = e^(0.00006*1000) ≈ 1.0618
      // Exceeds all three auto-cashout thresholds
      tickCallback!(1000);
      flushTickEvents();
      await flushPromises();

      const betWonEvents = batchedEventsOfType('bet_won');
      expect(betWonEvents).toHaveLength(3);
      expect(walletGateway.credit).toHaveBeenCalledTimes(3);

      const playerIds = betWonEvents.map((e) => e.snapshot.playerId);
      expect(playerIds).toContain('player-1');
      expect(playerIds).toContain('player-2');
      expect(playerIds).toContain('player-3');
    });

    it('auto-cashout in same tick as crash results in WIN, not LOSS', async () => {
      await useCase.start();

      placeBetHandler!({
        playerId: 'player-1',
        roundId: 'any',
        amountCents: 1000,
        autoCashout: 1.05,
      });

      timerCallback!();
      await flushPromises();

      // First tick at 500ms (multiplier ≈ 1.03, below auto-cashout threshold)
      tickCallback!(500);
      flushTickEvents();
      await flushPromises();

      expect(batchedEventsOfType('bet_won')).toHaveLength(0);

      // Crash tick: multiplier at 200000ms >>> 1.05 AND >>> crashPoint
      // Step 3 triggers auto-cashout (bet → WON) BEFORE
      // Step 4 triggers crash (settleAll only marks ACTIVE bets as LOST)
      tickCallback!(200000);
      await flushPromises();

      // The bet should be WON (auto-cashout), NOT LOST (crash)
      const betWonEvents = batchedEventsOfType('bet_won');
      expect(betWonEvents).toHaveLength(1);
      expect(betWonEvents[0].snapshot.playerId).toBe('player-1');
      expect(betWonEvents[0].snapshot.status).toBe('WON');

      // betLost should NOT be emitted for this bet (already WON)
      expect(batchedEventsOfType('bet_lost')).toHaveLength(0);

      // But the round DID crash
      expect(batchedEventsOfType('round_crashed')).toHaveLength(1);
    });
  });

  describe('crash handling', () => {
    it('emits roundCrashed and betLost on crash', async () => {
      await useCase.start();

      // Place a bet
      placeBetHandler!({
        playerId: 'player-1',
        roundId: 'any',
        amountCents: 1000,
      });

      timerCallback!();
      await flushPromises();

      // Tick with a very high elapsed time to guarantee crash
      // At 200000ms: multiplier = e^(0.00006 * 200000) = e^12 ≈ 162754
      // Any crash point will be exceeded
      tickCallback!(200000);
      await flushPromises();

      expect(batchedEventsOfType('round_crashed')).toHaveLength(1);
      expect(batchedEventsOfType('bet_lost')).toHaveLength(1);
      expect(tickScheduler.stop).toHaveBeenCalled();
    });

    it('stops tick scheduler on crash and schedules next round', async () => {
      await useCase.start();

      timerCallback!();
      await flushPromises();

      // Trigger crash
      tickCallback!(200000);
      await flushPromises();

      // stop is called once for crash (and once potentially at setup/stop)
      expect(tickScheduler.stop).toHaveBeenCalled();

      // Fire inter-round delay timer
      timerCallback!();
      await flushPromises();

      // A new round should start
      expect(eventPublisher.roundNew).toHaveBeenCalledTimes(2);
    });

    it('silently ignores cashout for non-existent bet during tick', async () => {
      await useCase.start();
      timerCallback!();
      await flushPromises();

      const roundId = (eventPublisher.roundNew as jest.Mock).mock.calls[0][0];
      cashoutHandler!({ playerId: 'player-1', roundId, betId: 'non-existent' });

      tickCallback!(100);
      flushTickEvents();
      await flushPromises();

      expect(walletGateway.credit).not.toHaveBeenCalled();
      expect(batchedEventsOfType('bet_won')).toHaveLength(0);
    });

    it('silently ignores cashout for wrong player', async () => {
      await useCase.start();

      placeBetHandler!({
        playerId: 'player-1',
        roundId: 'any',
        amountCents: 1000,
      });

      timerCallback!();
      await flushPromises();

      const roundId = (eventPublisher.roundNew as jest.Mock).mock.calls[0][0];
      const betId = Array.from(storedBets.keys())[0];

      // Wrong player tries to cashout
      cashoutHandler!({ playerId: 'player-2', roundId, betId });

      tickCallback!(500);
      flushTickEvents();
      await flushPromises();

      expect(walletGateway.credit).not.toHaveBeenCalled();
    });

    it('silently drops cashout with wrong roundId', async () => {
      await useCase.start();

      placeBetHandler!({
        playerId: 'player-1',
        roundId: 'any',
        amountCents: 1000,
      });

      timerCallback!();
      await flushPromises();

      const betId = Array.from(storedBets.keys())[0];

      // Cashout with wrong roundId is dropped by the onCashout guard
      cashoutHandler!({ playerId: 'player-1', roundId: 'wrong-round', betId });

      tickCallback!(500);
      flushTickEvents();
      await flushPromises();

      expect(walletGateway.credit).not.toHaveBeenCalled();
      expect(batchedEventsOfType('bet_won')).toHaveLength(0);
    });
  });

  describe('cashout-after-crash race condition', () => {
    it('ignores cashout queued after crash completes', async () => {
      await useCase.start();

      placeBetHandler!({
        playerId: 'player-1',
        roundId: 'any',
        amountCents: 1000,
      });

      // End betting → RUNNING
      timerCallback!();
      await flushPromises();

      const betId = Array.from(storedBets.keys())[0];

      // Trigger crash
      tickCallback!(200000);
      await flushPromises();

      (walletGateway.credit as jest.Mock).mockClear();
      (eventPublisher.publishBatch as jest.Mock).mockClear();

      // Queue cashout AFTER crash — the onCashout guard checks state !== RUNNING,
      // so for a CRASHED round this command is silently dropped before entering the queue
      const roundId = (eventPublisher.roundNew as jest.Mock).mock.calls[0][0];
      cashoutHandler!({ playerId: 'player-1', roundId, betId });

      // Start next round
      timerCallback!();
      await flushPromises();

      // End new round's betting phase → RUNNING
      timerCallback!();
      await flushPromises();

      // Fire a tick in the new round
      tickCallback!(100);
      flushTickEvents();
      await flushPromises();

      // Wallet must NOT be credited for the stale cashout
      expect(walletGateway.credit).not.toHaveBeenCalled();
      expect(batchedEventsOfType('bet_won')).toHaveLength(0);
    });

    it('game loop continues normally after stale cashout is dropped', async () => {
      await useCase.start();

      placeBetHandler!({
        playerId: 'player-1',
        roundId: 'any',
        amountCents: 1000,
      });

      timerCallback!();
      await flushPromises();

      const betId = Array.from(storedBets.keys())[0];

      // Crash the round
      tickCallback!(200000);
      await flushPromises();

      // Queue cashout after crash (dropped by guard)
      const roundId = (eventPublisher.roundNew as jest.Mock).mock.calls[0][0];
      cashoutHandler!({ playerId: 'player-1', roundId, betId });

      // Start next round, enter RUNNING, tick
      timerCallback!();
      await flushPromises();
      timerCallback!();
      await flushPromises();

      (eventPublisher.publishBatch as jest.Mock).mockClear();

      // This tick should not throw — game loop continues normally
      tickCallback!(100);
      flushTickEvents();
      await flushPromises();

      expect(batchedEventsOfType('tick')).toHaveLength(1);
    });
  });

  describe('wallet failure resilience', () => {
    it('emits betWon even when wallet credit rejects', async () => {
      await useCase.start();

      placeBetHandler!({
        playerId: 'player-1',
        roundId: 'any',
        amountCents: 1000,
      });

      timerCallback!();
      await flushPromises();

      const roundId = (eventPublisher.roundNew as jest.Mock).mock.calls[0][0];
      const betId = Array.from(storedBets.keys())[0];

      // Mock credit to reject AFTER bet placement (debit must succeed first)
      (walletGateway.credit as jest.Mock).mockRejectedValue(
        new Error('wallet service unavailable'),
      );

      // Queue cashout immediately after entering RUNNING
      cashoutHandler!({ playerId: 'player-1', roundId, betId });

      // Single tick processes the cashout
      tickCallback!(100);
      flushTickEvents();
      await flushPromises();
      // Extra flush to ensure the .catch() handler in CashoutUseCase has fired
      await flushPromises();

      // betWon should still be emitted (domain cashout succeeded)
      expect(batchedEventsOfType('bet_won')).toEqual([
        expect.objectContaining({ snapshot: expect.objectContaining({ betId }) }),
      ]);

      // Wallet credit was attempted
      expect(walletGateway.credit).toHaveBeenCalled();

      // The failed credit should be persisted for retry
      expect(failedCreditStore.save).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 'player-1',
          betId,
          reason: 'wallet service unavailable',
          resolved: false,
        }),
      );
    });

    it('continues game loop when wallet credit fails', async () => {
      await useCase.start();

      placeBetHandler!({
        playerId: 'player-1',
        roundId: 'any',
        amountCents: 1000,
      });

      timerCallback!();
      await flushPromises();

      const roundId = (eventPublisher.roundNew as jest.Mock).mock.calls[0][0];
      const betId = Array.from(storedBets.keys())[0];

      // Mock credit to reject AFTER bet placement
      (walletGateway.credit as jest.Mock).mockRejectedValue(new Error('network error'));

      // Queue cashout and process in a single tick
      cashoutHandler!({ playerId: 'player-1', roundId, betId });

      tickCallback!(100);
      flushTickEvents();
      await flushPromises();

      // Game loop continues — subsequent tick works fine
      tickCallback!(200);
      flushTickEvents();
      await flushPromises();

      // tick events emitted for both ticks (100 and 200)
      expect(batchedEventsOfType('tick')).toHaveLength(2);
    });
  });

  describe('seed chain progression', () => {
    it('uses different verifiable server seeds for consecutive rounds', async () => {
      await useCase.start();

      // Capture round 1's hashed seed
      const round1HashedSeed = (eventPublisher.roundNew as jest.Mock).mock.calls[0][1];

      // Enter RUNNING, trigger crash
      timerCallback!();
      await flushPromises();
      tickCallback!(200000);
      await flushPromises();

      // Capture round 1's revealed server seed from batch
      const round1CrashEvents = batchedEventsOfType('round_crashed');
      const round1ServerSeed = round1CrashEvents[0].serverSeed;

      // Verify: hash(serverSeed) === hashedSeed for round 1
      expect(ProvablyFair.hashServerSeed(round1ServerSeed)).toBe(round1HashedSeed);

      // Start round 2
      timerCallback!();
      await flushPromises();

      // Capture round 2's hashed seed
      const round2HashedSeed = (eventPublisher.roundNew as jest.Mock).mock.calls[1][1];

      // Round 2 must have a different hashed seed
      expect(round2HashedSeed).not.toBe(round1HashedSeed);

      // Enter RUNNING, trigger crash for round 2
      timerCallback!();
      await flushPromises();
      tickCallback!(200000);
      await flushPromises();

      // Capture round 2's revealed server seed from batch
      const allCrashEvents = batchedEventsOfType('round_crashed');
      const round2ServerSeed = allCrashEvents[1].serverSeed;

      // Verify: hash(serverSeed) === hashedSeed for round 2
      expect(ProvablyFair.hashServerSeed(round2ServerSeed)).toBe(round2HashedSeed);

      // Verify seed chain linkage: hash(round2_seed) === round1_seed
      // Because seeds are built as seed[0] = hash(seed[1])
      expect(SeedChain.verify(round2ServerSeed, round1ServerSeed)).toBe(true);
    });
  });

  describe('late bet rejection', () => {
    it('rejects bets arriving during RUNNING state', async () => {
      await useCase.start();

      // Fire betting window timer → RUNNING
      timerCallback!();
      await flushPromises();

      // Attempt to place a bet after betting has closed
      placeBetHandler!({
        playerId: 'player-late',
        roundId: 'old-round',
        amountCents: 500,
      });
      await flushPromises();

      expect(eventPublisher.betRejected).toHaveBeenCalledWith(
        'player-late',
        'old-round',
        500,
        'ROUND_NOT_BETTING',
      );
      // Wallet should never be debited for a rejected late bet
      expect(walletGateway.debit).not.toHaveBeenCalled();
    });

    it('does not leak stale bets into the next round', async () => {
      await useCase.start();

      // Fire betting window timer → RUNNING
      timerCallback!();
      await flushPromises();

      // Place a bet during RUNNING (rejected by guard)
      placeBetHandler!({
        playerId: 'player-stale',
        roundId: 'stale-round',
        amountCents: 1000,
      });
      await flushPromises();

      // Trigger crash
      tickCallback!(200000);
      await flushPromises();

      // Clear mock call history before the next round
      (eventPublisher.betRejected as jest.Mock).mockClear();
      (eventPublisher.betPlaced as jest.Mock).mockClear();

      // Fire inter-round delay timer → new round starts
      timerCallback!();
      await flushPromises();

      // Fire new round's betting window timer
      timerCallback!();
      await flushPromises();

      // The stale bet should NOT appear as betPlaced in the new round
      expect(eventPublisher.betPlaced).not.toHaveBeenCalled();
      // No stale-bet rejections during startNewRound drain either
      // (because the guard already rejected it)
      expect(eventPublisher.betRejected).not.toHaveBeenCalled();
    });

    it('rejects bets arriving during CRASHED state', async () => {
      await useCase.start();

      timerCallback!();
      await flushPromises();

      // Trigger crash
      tickCallback!(200000);
      await flushPromises();

      (eventPublisher.betRejected as jest.Mock).mockClear();

      // Attempt to place a bet after crash
      placeBetHandler!({
        playerId: 'player-post-crash',
        roundId: 'crashed-round',
        amountCents: 500,
      });
      await flushPromises();

      expect(eventPublisher.betRejected).toHaveBeenCalledWith(
        'player-post-crash',
        'crashed-round',
        500,
        'ROUND_NOT_BETTING',
      );
    });

    it('does not accumulate rejected late bets in betStore', async () => {
      await useCase.start();

      // Enter RUNNING
      timerCallback!();
      await flushPromises();

      // Send 5 late bets during RUNNING — all rejected by the guard
      for (let i = 0; i < 5; i++) {
        placeBetHandler!({
          playerId: `player-late-${i}`,
          roundId: 'old-round',
          amountCents: 1000,
        });
      }
      await flushPromises();

      // betStore should have NO entries (bets never reached PlaceBetUseCase)
      expect(betStore.add).not.toHaveBeenCalled();
      expect(walletGateway.debit).not.toHaveBeenCalled();

      // Crash and start new round
      tickCallback!(200000);
      await flushPromises();

      (betStore.add as jest.Mock).mockClear();
      (eventPublisher.betPlaced as jest.Mock).mockClear();

      timerCallback!();
      await flushPromises();

      // End new round's betting phase (no bets queued)
      timerCallback!();
      await flushPromises();

      // No stale data carried over
      expect(betStore.add).not.toHaveBeenCalled();
      expect(eventPublisher.betPlaced).not.toHaveBeenCalled();
    });
  });

  describe('promise tracking and backpressure', () => {
    it('warns when event promises exceed high water mark', async () => {
      const trackedUseCase = new RunGameLoopUseCase(
        config,
        seedChain,
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
        2, // eventPromiseHighWaterMark
      );

      await trackedUseCase.start();
      timerCallback!();
      await flushPromises();

      // Make publishBatch return slow promises that never resolve during this test
      const resolvers: (() => void)[] = [];
      (eventPublisher.publishBatch as jest.Mock).mockImplementation(
        () => new Promise<void>((resolve) => resolvers.push(resolve)),
      );

      // Trigger 3 ticks (threshold is 2)
      tickCallback!(100);
      flushTickEvents();
      tickCallback!(150);
      flushTickEvents();
      tickCallback!(200);
      flushTickEvents();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('High water mark exceeded'),
        expect.objectContaining({ category: 'events' }),
      );

      resolvers.forEach((r) => r());
      trackedUseCase.stop();
    });

    it('does not warn when below high water mark', async () => {
      await useCase.start();
      timerCallback!();
      await flushPromises();

      // Default high water mark is 100; one tick won't exceed it
      tickCallback!(100);
      flushTickEvents();
      await flushPromises();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('warns on stop if event promises are pending', async () => {
      (eventPublisher.publishBatch as jest.Mock).mockReturnValue(new Promise(() => {}));

      await useCase.start();
      timerCallback!();
      await flushPromises();

      tickCallback!(100);
      flushTickEvents();

      useCase.stop();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('pending event promises'),
        expect.objectContaining({ pendingEvents: expect.any(Number) }),
      );
    });

    it('drain() resolves when all tracked promises settle', async () => {
      let resolveBatchPromise!: () => void;
      (eventPublisher.publishBatch as jest.Mock).mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveBatchPromise = resolve;
          }),
      );

      await useCase.start();
      timerCallback!();
      await flushPromises();

      tickCallback!(100);
      flushTickEvents();

      const drainPromise = useCase.drain();
      resolveBatchPromise();
      await drainPromise;
    });
  });
});

function flushPromises(): Promise<void> {
  return new Promise((resolve) => process.nextTick(resolve));
}
