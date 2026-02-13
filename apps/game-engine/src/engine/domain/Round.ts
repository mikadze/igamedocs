import { RoundState, canTransition } from '@engine/domain/RoundState';
import { CrashPoint } from '@engine/domain/CrashPoint';
import { BetCollection } from '@betting/domain/BetCollection';
import { Bet } from '@betting/domain/Bet';
import { Money } from '@shared/kernel/Money';
import { InvalidStateTransition } from '@shared/kernel/DomainError';

export class Round {
  private _state: RoundState = RoundState.WAITING;
  private _currentMultiplier: number = 1.0;
  private readonly _bets: BetCollection = new BetCollection();

  constructor(
    readonly id: string,
    private readonly crashPoint: CrashPoint,
    readonly hashedSeed: string,
  ) {}

  get state(): RoundState {
    return this._state;
  }

  get currentMultiplier(): number {
    return this._currentMultiplier;
  }

  get bets(): BetCollection {
    return this._bets;
  }

  openBetting(): void {
    this.transitionTo(RoundState.BETTING);
  }

  startFlying(): void {
    this.transitionTo(RoundState.RUNNING);
  }

  tick(multiplier: number): boolean {
    if (this._state !== RoundState.RUNNING) {
      throw new InvalidStateTransition('Cannot tick when not RUNNING');
    }
    this._currentMultiplier = multiplier;
    if (multiplier >= this.crashPoint.value) {
      this._state = RoundState.CRASHED;
      this._bets.settleAll();
      return true;
    }
    return false;
  }

  addBet(bet: Bet): void {
    if (this._state !== RoundState.BETTING) {
      throw new InvalidStateTransition('Cannot add bet when not in BETTING state');
    }
    bet.activate();
    this._bets.add(bet);
  }

  cashout(betId: string): Money {
    if (this._state !== RoundState.RUNNING) {
      throw new InvalidStateTransition('Cannot cashout when not RUNNING');
    }
    const bet = this._bets.getById(betId);
    if (!bet) {
      throw new Error(`Bet ${betId} not found`);
    }
    return bet.cashout(this._currentMultiplier);
  }

  private transitionTo(newState: RoundState): void {
    if (!canTransition(this._state, newState)) {
      throw new InvalidStateTransition(
        `Cannot transition from ${this._state} to ${newState}`,
      );
    }
    this._state = newState;
  }
}
