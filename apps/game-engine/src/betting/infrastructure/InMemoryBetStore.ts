import { Injectable } from '@nestjs/common';
import { Bet } from '@engine/domain/Bet';
import { BetStatus } from '@engine/domain/BetStatus';
import { BetStore } from '@betting/application/ports/BetStore';

@Injectable()
export class InMemoryBetStore implements BetStore {
  private readonly bets: Map<string, Bet> = new Map();
  private readonly byRound: Map<string, Bet[]> = new Map();
  private readonly byIdempotencyKey: Map<string, Bet> = new Map();

  add(bet: Bet): void {
    const existing = this.bets.get(bet.id);
    if (existing) {
      const roundBets = this.byRound.get(existing.roundId);
      if (roundBets) {
        const idx = roundBets.indexOf(existing);
        if (idx !== -1) roundBets.splice(idx, 1);
      }
    }

    this.bets.set(bet.id, bet);
    if (bet.idempotencyKey) {
      this.byIdempotencyKey.set(bet.idempotencyKey, bet);
    }

    let roundBets = this.byRound.get(bet.roundId);
    if (!roundBets) {
      roundBets = [];
      this.byRound.set(bet.roundId, roundBets);
    }
    roundBets.push(bet);
  }

  getById(betId: string): Bet | undefined {
    return this.bets.get(betId);
  }

  findByIdempotencyKey(key: string): Bet | undefined {
    return this.byIdempotencyKey.get(key);
  }

  getByRound(roundId: string): Bet[] {
    return [...(this.byRound.get(roundId) ?? [])];
  }

  getActiveByRound(roundId: string): Bet[] {
    const roundBets = this.byRound.get(roundId);
    if (!roundBets) return [];
    return roundBets.filter((b) => b.status === BetStatus.ACTIVE);
  }

  clearRound(roundId: string): void {
    const roundBets = this.byRound.get(roundId);
    if (!roundBets) return;

    for (const bet of roundBets) {
      this.bets.delete(bet.id);
      if (bet.idempotencyKey) {
        this.byIdempotencyKey.delete(bet.idempotencyKey);
      }
    }
    this.byRound.delete(roundId);
  }
}
