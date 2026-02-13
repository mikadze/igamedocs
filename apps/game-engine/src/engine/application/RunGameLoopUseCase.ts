import { randomUUID } from 'crypto';
import { Round } from '@engine/domain/Round';
import { Multiplier } from '@engine/domain/Multiplier';
import { GameConfig } from '@engine/domain/GameConfig';
import {
  EventPublisher,
  BetSnapshot,
  toBetSnapshot,
} from '@engine/application/ports/EventPublisher';
import { EventSubscriber } from '@engine/application/ports/EventSubscriber';
import { TickScheduler } from '@engine/application/ports/TickScheduler';
import { GetRoundStateUseCase } from '@engine/application/GetRoundStateUseCase';
import { PlaceBetUseCase } from '@betting/application/PlaceBetUseCase';
import { CashoutUseCase } from '@betting/application/CashoutUseCase';
import { PlaceBetCommand } from '@betting/application/commands/PlaceBetCommand';
import { CashoutCommand } from '@betting/application/commands/CashoutCommand';
import { BetStore } from '@betting/application/ports/BetStore';
import { ProvablyFair } from '@rng/domain/ProvablyFair';
import { SeedChain } from '@rng/domain/SeedChain';

export class RunGameLoopUseCase {
  private currentRound: Round | null = null;
  private serverSeed: string = '';
  private nonce: number = 0;
  private readonly cashoutQueue: CashoutCommand[] = [];
  private readonly placeBetQueue: PlaceBetCommand[] = [];
  private running: boolean = false;

  constructor(
    private readonly config: GameConfig,
    private readonly seedChain: SeedChain,
    private readonly eventPublisher: EventPublisher,
    private readonly eventSubscriber: EventSubscriber,
    private readonly tickScheduler: TickScheduler,
    private readonly placeBetUseCase: PlaceBetUseCase,
    private readonly cashoutUseCase: CashoutUseCase,
    private readonly getRoundStateUseCase: GetRoundStateUseCase,
    private readonly betStore: BetStore,
    private readonly clientSeed: string = 'default-client-seed',
  ) {}

  async start(): Promise<void> {
    this.running = true;

    this.eventSubscriber.onPlaceBet((cmd) => {
      this.placeBetQueue.push(cmd);
    });

    this.eventSubscriber.onCashout((cmd) => {
      this.cashoutQueue.push(cmd);
    });

    await this.startNewRound();
  }

  stop(): void {
    this.running = false;
    this.tickScheduler.stop();
    this.currentRound = null;
    this.getRoundStateUseCase.setCurrentRound(null);
  }

  private async startNewRound(): Promise<void> {
    if (!this.running) return;

    this.serverSeed = this.seedChain.next();
    const hashedSeed = ProvablyFair.hashServerSeed(this.serverSeed);
    const crashPoint = ProvablyFair.calculateCrashPoint(
      this.serverSeed,
      this.clientSeed,
      this.nonce,
      this.config.houseEdgePercent,
    );
    this.nonce++;

    const roundId = randomUUID();
    this.currentRound = new Round(roundId, crashPoint, hashedSeed);
    this.getRoundStateUseCase.setCurrentRound(this.currentRound);

    this.currentRound.openBetting();
    await this.eventPublisher.roundNew(roundId, hashedSeed);
    await this.eventPublisher.roundBetting(
      roundId,
      Date.now() + this.config.bettingWindowMs,
    );

    setTimeout(() => this.endBettingPhase(), this.config.bettingWindowMs);
  }

  private async endBettingPhase(): Promise<void> {
    if (!this.running || !this.currentRound) return;

    // Drain place-bet queue
    const betsToPlace = this.placeBetQueue.splice(0);
    for (const cmd of betsToPlace) {
      const result = await this.placeBetUseCase.execute(cmd);
      if (result.success) {
        const bet = this.betStore.getById(result.betId);
        if (bet) {
          this.currentRound.addBet(bet);
          await this.eventPublisher.betPlaced(toBetSnapshot(bet));
        }
      } else {
        await this.eventPublisher.betRejected(
          cmd.playerId,
          this.currentRound.id,
          cmd.amountCents,
          result.error,
        );
      }
    }

    this.currentRound.startFlying();
    await this.eventPublisher.roundStarted(this.currentRound.id);

    this.tickScheduler.start((elapsedMs) => this.onTick(elapsedMs));
  }

  private onTick(elapsedMs: number): void {
    if (!this.currentRound) return;

    const round = this.currentRound;
    const wonSnapshots: BetSnapshot[] = [];

    // Step 1: Drain cashout queue and process each (domain ops are synchronous)
    const cashouts = this.cashoutQueue.splice(0);
    for (const cmd of cashouts) {
      try {
        const bet = round.bets.getById(cmd.betId);
        if (!bet || bet.playerId !== cmd.playerId) continue;

        const payout = round.cashout(cmd.betId);
        // Fire-and-forget: wallet credit is I/O, must not block the tick
        this.cashoutUseCase.creditWinnings(
          cmd.playerId, payout, round.id, cmd.betId,
        ).catch(() => {});
        wonSnapshots.push(toBetSnapshot(bet));
      } catch {
        // Bet not active or already settled — skip silently
      }
    }

    // Step 2: Calculate multiplier
    const multiplier = Multiplier.at(elapsedMs);

    // Step 3: Process auto-cashouts
    const autoCashouts = round.bets.getAutoCashouts(multiplier.value);
    for (const bet of autoCashouts) {
      try {
        const payout = round.cashout(bet.id);
        // Fire-and-forget: wallet credit is I/O, must not block the tick
        this.cashoutUseCase.creditWinnings(
          bet.playerId, payout, round.id, bet.id,
        ).catch(() => {});
        wonSnapshots.push(toBetSnapshot(bet));
      } catch {
        // Already cashed out in step 1 — skip
      }
    }

    // Step 4: Crash check via round.tick()
    const crashed = round.tick(multiplier.value);

    // Step 5: Emit events (fire-and-forget — I/O must not block the tick)
    for (const snapshot of wonSnapshots) {
      this.eventPublisher.betWon(snapshot).catch(() => {});
    }

    if (crashed) {
      const crashPointValue = multiplier.value;

      this.eventPublisher.roundCrashed(
        round.id, crashPointValue, this.serverSeed,
      ).catch(() => {});

      // Emit betLost for all bets that were settled as lost
      const allBets = round.bets.getAll();
      for (const bet of allBets) {
        if (bet.payout?.isZero()) {
          this.eventPublisher.betLost(
            toBetSnapshot(bet), crashPointValue,
          ).catch(() => {});
        }
      }

      this.tickScheduler.stop();
      this.scheduleNextRound();
    } else {
      this.eventPublisher.tick(round.id, multiplier.value, elapsedMs).catch(() => {});
    }
  }

  private scheduleNextRound(): void {
    if (!this.running) return;
    setTimeout(() => this.startNewRound(), 1000);
  }
}
