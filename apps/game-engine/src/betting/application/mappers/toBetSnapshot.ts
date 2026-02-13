import { Bet } from '@betting/domain/Bet';
import { BetSnapshot } from '@shared/kernel/BetSnapshot';

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
