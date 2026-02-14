import { Money } from '@shared/kernel/Money';

export interface BalanceCache {
  get(
    operatorId: string,
    playerId: string,
  ): Promise<{ balance: Money; currency: string } | null>;

  set(
    operatorId: string,
    playerId: string,
    balance: Money,
    currency: string,
    ttlSeconds: number,
  ): Promise<void>;

  acquireLock(
    operatorId: string,
    playerId: string,
    ttlSeconds: number,
  ): Promise<boolean>;

  releaseLock(operatorId: string, playerId: string): Promise<void>;
}
