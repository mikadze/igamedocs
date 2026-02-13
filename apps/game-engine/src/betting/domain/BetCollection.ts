import { Bet } from '@betting/domain/Bet';
import { BetStatus } from '@betting/domain/BetStatus';
import { DomainError } from '@shared/kernel/DomainError';

export class BetCollection {
  private readonly bets: Map<string, Bet> = new Map();

  add(bet: Bet): void {
    if (this.bets.has(bet.id)) {
      throw new DomainError(`Bet with ID ${bet.id} already exists`);
    }
    this.bets.set(bet.id, bet);
  }

  getById(id: string): Bet | undefined {
    return this.bets.get(id);
  }

  getActive(): Bet[] {
    return Array.from(this.bets.values()).filter((b) => b.status === BetStatus.ACTIVE);
  }

  settleAll(): void {
    for (const bet of this.bets.values()) {
      if (bet.status === BetStatus.ACTIVE) {
        bet.lose();
      }
    }
  }

  getAutoCashouts(multiplier: number): Bet[] {
    return this.getActive().filter((b) => b.shouldAutoCashout(multiplier));
  }

  forEachAutoCashout(multiplier: number, callback: (bet: Bet) => void): void {
    for (const bet of this.bets.values()) {
      if (bet.status === BetStatus.ACTIVE && bet.shouldAutoCashout(multiplier)) {
        callback(bet);
      }
    }
  }

  forEachByStatus(status: BetStatus, callback: (bet: Bet) => void): void {
    for (const bet of this.bets.values()) {
      if (bet.status === status) {
        callback(bet);
      }
    }
  }

  get size(): number {
    return this.bets.size;
  }

  getAll(): Bet[] {
    return Array.from(this.bets.values());
  }
}
