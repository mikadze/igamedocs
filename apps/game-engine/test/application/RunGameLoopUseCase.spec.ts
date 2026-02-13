import { RunGameLoopUseCase } from '@engine/application/RunGameLoopUseCase';
import { GetRoundStateUseCase } from '@engine/application/GetRoundStateUseCase';
import { EventPublisher } from '@engine/application/ports/EventPublisher';
import { EventSubscriber } from '@engine/application/ports/EventSubscriber';
import { TickScheduler } from '@engine/application/ports/TickScheduler';
import { PlaceBetUseCase } from '@betting/application/PlaceBetUseCase';
import { CashoutUseCase } from '@betting/application/CashoutUseCase';
import { BetStore } from '@betting/application/ports/BetStore';
import { WalletGateway, WalletResult } from '@betting/application/ports/WalletGateway';
import { PlaceBetCommand } from '@betting/application/commands/PlaceBetCommand';
import { CashoutCommand } from '@betting/application/commands/CashoutCommand';
import { Bet } from '@betting/domain/Bet';
import { GameConfig } from '@engine/domain/GameConfig';
import { SeedChain } from '@rng/domain/SeedChain';
import { ProvablyFair } from '@rng/domain/ProvablyFair';
import { Money } from '@shared/kernel/Money';
import { RoundState } from '@engine/domain/RoundState';

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
  let betStore: BetStore;
  let walletGateway: WalletGateway;
  let placeBetUseCase: PlaceBetUseCase;
  let cashoutUseCase: CashoutUseCase;
  let getRoundStateUseCase: GetRoundStateUseCase;
  let useCase: RunGameLoopUseCase;

  // Capture handlers registered via EventSubscriber
  let placeBetHandler: ((cmd: PlaceBetCommand) => void) | null;
  let cashoutHandler: ((cmd: CashoutCommand) => void) | null;

  // Capture tick callback registered via TickScheduler
  let tickCallback: ((elapsedMs: number) => void) | null;

  const successWalletResult: WalletResult = {
    success: true,
    transactionId: 'tx-1',
    newBalance: Money.fromCents(9000),
  };

  let storedBets: Map<string, Bet>;

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });

    const terminalSeed = ProvablyFair.generateServerSeed();
    seedChain = new SeedChain(terminalSeed, 100);

    placeBetHandler = null;
    cashoutHandler = null;
    tickCallback = null;

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
    };

    eventSubscriber = {
      onPlaceBet: jest.fn((handler) => {
        placeBetHandler = handler;
      }),
      onCashout: jest.fn((handler) => {
        cashoutHandler = handler;
      }),
    };

    tickScheduler = {
      start: jest.fn((cb) => {
        tickCallback = cb;
      }),
      stop: jest.fn(),
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

    placeBetUseCase = new PlaceBetUseCase(config, betStore, walletGateway);
    cashoutUseCase = new CashoutUseCase(walletGateway);
    getRoundStateUseCase = new GetRoundStateUseCase();

    useCase = new RunGameLoopUseCase(
      config,
      seedChain,
      eventPublisher,
      eventSubscriber,
      tickScheduler,
      placeBetUseCase,
      cashoutUseCase,
      getRoundStateUseCase,
      betStore,
    );
  });

  afterEach(() => {
    useCase.stop();
    jest.useRealTimers();
  });

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
  });

  describe('round lifecycle', () => {
    it('transitions from BETTING to RUNNING after betting window', async () => {
      await useCase.start();

      // Advance past betting window
      jest.advanceTimersByTime(config.bettingWindowMs);
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

      // Advance past betting window
      jest.advanceTimersByTime(config.bettingWindowMs);
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

      jest.advanceTimersByTime(config.bettingWindowMs);
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
    it('emits tick events during running phase', async () => {
      await useCase.start();
      jest.advanceTimersByTime(config.bettingWindowMs);
      await flushPromises();

      // Simulate a tick at 100ms (multiplier ~1.006)
      tickCallback!(100);
      await flushPromises();

      expect(eventPublisher.tick).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        100,
      );
    });

    it('processes cashouts during tick', async () => {
      await useCase.start();

      // Place a bet during betting phase
      placeBetHandler!({
        playerId: 'player-1',
        roundId: 'any',
        amountCents: 1000,
      });

      jest.advanceTimersByTime(config.bettingWindowMs);
      await flushPromises();

      // Find the bet ID that was placed
      const betId = Array.from(storedBets.keys())[0];

      // Tick to set a multiplier
      tickCallback!(500);
      await flushPromises();

      // Queue a cashout command
      cashoutHandler!({ playerId: 'player-1', betId });

      // Next tick processes the cashout
      tickCallback!(600);
      await flushPromises();

      expect(walletGateway.credit).toHaveBeenCalled();
      expect(eventPublisher.betWon).toHaveBeenCalledWith(
        expect.objectContaining({ betId }),
      );
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

      jest.advanceTimersByTime(config.bettingWindowMs);
      await flushPromises();

      // Tick at time when multiplier is well above 1.05
      // Multiplier.at(1000) = e^(0.00006*1000) = e^0.06 ≈ 1.0618
      tickCallback!(1000);
      await flushPromises();

      expect(eventPublisher.betWon).toHaveBeenCalledTimes(1);
      expect(walletGateway.credit).toHaveBeenCalled();
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

      jest.advanceTimersByTime(config.bettingWindowMs);
      await flushPromises();

      // Tick with a very high elapsed time to guarantee crash
      // At 200000ms: multiplier = e^(0.00006 * 200000) = e^12 ≈ 162754
      // Any crash point will be exceeded
      tickCallback!(200000);
      await flushPromises();

      expect(eventPublisher.roundCrashed).toHaveBeenCalledTimes(1);
      expect(eventPublisher.betLost).toHaveBeenCalledTimes(1);
      expect(tickScheduler.stop).toHaveBeenCalled();
    });

    it('stops tick scheduler on crash and schedules next round', async () => {
      await useCase.start();

      jest.advanceTimersByTime(config.bettingWindowMs);
      await flushPromises();

      // Trigger crash
      tickCallback!(200000);
      await flushPromises();

      // stop is called once for crash (and once potentially at setup/stop)
      expect(tickScheduler.stop).toHaveBeenCalled();

      // Advance past the inter-round delay (1 second)
      jest.advanceTimersByTime(1000);
      await flushPromises();

      // A new round should start
      expect(eventPublisher.roundNew).toHaveBeenCalledTimes(2);
    });

    it('silently ignores cashout for non-existent bet during tick', async () => {
      await useCase.start();
      jest.advanceTimersByTime(config.bettingWindowMs);
      await flushPromises();

      cashoutHandler!({ playerId: 'player-1', betId: 'non-existent' });

      tickCallback!(100);
      await flushPromises();

      expect(walletGateway.credit).not.toHaveBeenCalled();
      expect(eventPublisher.betWon).not.toHaveBeenCalled();
    });

    it('silently ignores cashout for wrong player', async () => {
      await useCase.start();

      placeBetHandler!({
        playerId: 'player-1',
        roundId: 'any',
        amountCents: 1000,
      });

      jest.advanceTimersByTime(config.bettingWindowMs);
      await flushPromises();

      const betId = Array.from(storedBets.keys())[0];

      // Wrong player tries to cashout
      cashoutHandler!({ playerId: 'player-2', betId });

      tickCallback!(500);
      await flushPromises();

      expect(walletGateway.credit).not.toHaveBeenCalled();
    });
  });
});

function flushPromises(): Promise<void> {
  return new Promise((resolve) => process.nextTick(resolve));
}
