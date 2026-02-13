import { randomUUID } from 'crypto';
import { Round } from '@engine/domain/Round';
import { Multiplier } from '@engine/domain/Multiplier';
import { GameConfig } from '@shared/kernel/GameConfig';
import { EventPublisher } from '@engine/application/ports/EventPublisher';
import { BetSnapshot } from '@shared/kernel/BetSnapshot';
import { toBetSnapshot } from '@engine/application/mappers/toBetSnapshot';
import { EventSubscriber } from '@engine/application/ports/EventSubscriber';
import { TickScheduler } from '@engine/application/ports/TickScheduler';
import { Timer } from '@engine/application/ports/Timer';
import { CurrentRoundStore } from '@engine/application/ports/CurrentRoundStore';
import { PlaceBetUseCase } from '@betting/application/PlaceBetUseCase';
import { CashoutUseCase } from '@betting/application/CashoutUseCase';
import { PlaceBetCommand } from '@betting/application/commands/PlaceBetCommand';
import { CashoutCommand } from '@betting/application/commands/CashoutCommand';
import { BetStatus } from '@engine/domain/BetStatus';
import { RoundState } from '@engine/domain/RoundState';
import { ProvablyFair } from '@rng/domain/ProvablyFair';
import { ClientSeedProvider } from '@engine/application/ports/ClientSeedProvider';
import { Logger } from '@shared/ports/Logger';
import { PromiseTracker } from '@engine/application/PromiseTracker';
import { SeedChain } from '@rng/domain/SeedChain';
import { TickEventBuffer } from '@engine/application/TickEventBuffer';
import { FailedEventStore } from '@engine/application/ports/FailedEventStore';

export class RunGameLoopUseCase {
  private serverSeed: string = '';
  private nonce: number = 0;
  private readonly cashoutQueue: CashoutCommand[] = [];
  private readonly placeBetQueue: PlaceBetCommand[] = [];
  private running: boolean = false;
  private readonly wonSnapshots: BetSnapshot[] = [];
  private readonly eventTracker: PromiseTracker;
  private readonly tickEvents = new TickEventBuffer();
  private flushScheduled = false;

  constructor(
    private readonly config: GameConfig,
    private readonly seedChain: SeedChain,
    private readonly eventPublisher: EventPublisher,
    private readonly eventSubscriber: EventSubscriber,
    private readonly tickScheduler: TickScheduler,
    private readonly timer: Timer,
    private readonly placeBetUseCase: PlaceBetUseCase,
    private readonly cashoutUseCase: CashoutUseCase,
    private readonly currentRoundStore: CurrentRoundStore,
    private readonly clientSeedProvider: ClientSeedProvider,
    private readonly logger: Logger,
    private readonly failedEventStore: FailedEventStore,
    eventPromiseHighWaterMark: number = 100,
  ) {
    this.eventTracker = new PromiseTracker(
      'events',
      eventPromiseHighWaterMark,
      logger,
    );
  }

  async start(): Promise<void> {
    if (this.running) throw new Error('Game loop is already running');
    this.running = true;

    this.eventSubscriber.onPlaceBet((cmd) => {
      if (this.currentRoundStore.get()?.state !== RoundState.BETTING) {
        this.trackEvent(this.eventPublisher.betRejected(
          cmd.playerId,
          cmd.roundId,
          cmd.amountCents,
          'ROUND_NOT_BETTING',
        ));
        return;
      }
      this.placeBetQueue.push(cmd);
    });

    this.eventSubscriber.onCashout((cmd) => {
      const round = this.currentRoundStore.get();
      if (!round || round.state !== RoundState.RUNNING) return;
      if (cmd.roundId !== round.id) return;
      this.cashoutQueue.push(cmd);
    });

    await this.startNewRound();
  }

  stop(): void {
    this.running = false;
    this.timer.clear();
    this.tickScheduler.stop();
    this.flushEvents();

    if (this.eventTracker.size > 0) {
      this.logger.warn('Stopping game loop with pending event promises', {
        pendingEvents: this.eventTracker.size,
      });
    }

    this.currentRoundStore.set(null);
  }

  async drain(): Promise<void> {
    this.flushEvents();
    await this.eventTracker.drain();
  }

  private trackEvent(promise: Promise<void>): void {
    promise.catch(() => {});
    this.eventTracker.track(promise);
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    this.timer.scheduleImmediate(() => this.flushEvents());
  }

  private flushEvents(): void {
    this.flushScheduled = false;
    const events = this.tickEvents.swap();
    if (events.length === 0) return;

    const batchDone = this.eventPublisher.publishBatch(events).catch((err) => {
      this.logger.error('Event batch publish failed', {
        count: events.length,
        error: err instanceof Error ? err.message : String(err),
      });
      this.failedEventStore.addBatch(events);
    });
    this.eventTracker.track(batchDone);
  }

  private async startNewRound(): Promise<void> {
    if (!this.running) return;

    // Reject any stale bets left from the previous round
    const staleBets = this.placeBetQueue.splice(0);
    for (const cmd of staleBets) {
      this.trackEvent(this.eventPublisher.betRejected(
        cmd.playerId,
        cmd.roundId,
        cmd.amountCents,
        'ROUND_NOT_BETTING',
      ));
    }

    this.serverSeed = this.seedChain.next();
    const hashedSeed = ProvablyFair.hashServerSeed(this.serverSeed);
    const clientSeed = this.clientSeedProvider.next();
    const crashPoint = ProvablyFair.calculateCrashPoint(
      this.serverSeed,
      clientSeed,
      this.nonce,
      this.config.houseEdgePercent,
    );
    this.nonce++;

    const roundId = randomUUID();
    const round = new Round(roundId, crashPoint, hashedSeed);
    this.currentRoundStore.set(round);

    round.openBetting();
    await this.eventPublisher.roundNew(roundId, hashedSeed);
    await this.eventPublisher.roundBetting(
      roundId,
      Date.now() + this.config.bettingWindowMs,
    );

    this.timer.schedule(() => this.endBettingPhase(), this.config.bettingWindowMs);
  }

  private async endBettingPhase(): Promise<void> {
    const currentRound = this.currentRoundStore.get();
    if (!this.running || !currentRound) return;

    const betsToPlace = this.placeBetQueue.splice(0);
    for (const cmd of betsToPlace) {
      const result = await this.placeBetUseCase.execute(cmd, currentRound);
      if (result.success) {
        await this.eventPublisher.betPlaced(result.snapshot);
      } else {
        await this.eventPublisher.betRejected(
          cmd.playerId,
          currentRound.id,
          cmd.amountCents,
          result.error,
        );
      }
    }

    currentRound.startFlying();
    await this.eventPublisher.roundStarted(currentRound.id);

    this.tickScheduler.start((elapsedMs) => this.onTick(elapsedMs));
  }

  private onTick(elapsedMs: number): void {
    const round = this.currentRoundStore.get();
    if (!round || round.state !== RoundState.RUNNING) return;
    this.wonSnapshots.length = 0;

    // Step 1: Drain cashout queue in-place (no splice allocation)
    for (let i = 0; i < this.cashoutQueue.length; i++) {
      const cmd = this.cashoutQueue[i];
      const result = this.cashoutUseCase.execute(cmd, round);
      if (result.success) {
        const bet = round.bets.getById(cmd.betId);
        if (bet) this.wonSnapshots.push(toBetSnapshot(bet));
      }
    }
    this.cashoutQueue.length = 0;

    // Step 2: Calculate multiplier (no object wrapper)
    const multiplier = Multiplier.valueAt(elapsedMs, this.config.growthRate);

    // Step 3: Process auto-cashouts (single-pass, no intermediate arrays)
    round.bets.forEachAutoCashout(multiplier, (bet) => {
      const result = this.cashoutUseCase.execute(
        { playerId: bet.playerId, roundId: round.id, betId: bet.id },
        round,
      );
      if (result.success) {
        this.wonSnapshots.push(toBetSnapshot(bet));
      }
    });

    // Step 4: Crash check via round.tick()
    const crashed = round.tick(multiplier);

    // Step 5: Collect events as plain data — zero I/O, zero promises
    for (let i = 0; i < this.wonSnapshots.length; i++) {
      this.tickEvents.push({ type: 'bet_won', snapshot: this.wonSnapshots[i] });
    }

    if (crashed) {
      this.tickEvents.push({
        type: 'round_crashed',
        roundId: round.id,
        multiplier,
        serverSeed: this.serverSeed,
      });
      round.bets.forEachByStatus(BetStatus.LOST, (bet) => {
        this.tickEvents.push({
          type: 'bet_lost',
          snapshot: toBetSnapshot(bet),
          multiplier,
        });
      });
      this.tickScheduler.stop();
      this.flushEvents();
      this.scheduleNextRound();
    } else {
      this.tickEvents.push({
        type: 'tick',
        roundId: round.id,
        multiplier,
        elapsedMs,
      });
      this.scheduleFlush();
    }
  }

  private scheduleNextRound(): void {
    if (!this.running) return;
    this.timer.schedule(() => this.startNewRound(), 1000);
  }
}
