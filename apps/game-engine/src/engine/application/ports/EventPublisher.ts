import { Bet } from '@betting/domain/Bet';
import { BetStatus } from '@betting/domain/BetStatus';

export interface BetSnapshot {
  betId: string;
  playerId: string;
  roundId: string;
  amountCents: number;
  status: BetStatus;
  cashoutMultiplier?: number;
  payoutCents?: number;
}

export function toBetSnapshot(bet: Bet): BetSnapshot {
  return {
    betId: bet.id,
    playerId: bet.playerId,
    roundId: bet.roundId,
    amountCents: bet.amount.toCents(),
    status: bet.status,
    cashoutMultiplier: bet.cashoutMultiplier,
    payoutCents: bet.payout?.toCents(),
  };
}

export interface EventPublisher {
  roundNew(roundId: string, hashedSeed: string): Promise<void>;
  roundBetting(roundId: string, endsAt: number): Promise<void>;
  roundStarted(roundId: string): Promise<void>;
  roundCrashed(
    roundId: string,
    crashPoint: number,
    serverSeed: string,
  ): Promise<void>;
  tick(roundId: string, multiplier: number, elapsed: number): Promise<void>;
  betPlaced(bet: BetSnapshot): Promise<void>;
  betWon(bet: BetSnapshot): Promise<void>;
  betLost(bet: BetSnapshot, crashPoint: number): Promise<void>;
  betRejected(
    playerId: string,
    roundId: string,
    amountCents: number,
    error: string,
  ): Promise<void>;
}
