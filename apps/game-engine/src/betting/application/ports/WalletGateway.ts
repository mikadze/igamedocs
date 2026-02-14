import { Money } from '@shared/kernel/Money';

export type WalletResult =
  | { success: true; transactionId: string; newBalance: Money }
  | { success: false; error: 'INSUFFICIENT_FUNDS' | 'PLAYER_BLOCKED' | 'TIMEOUT' };

export interface WalletGateway {
  debit(
    playerId: string,
    amount: Money,
    roundId: string,
    betId: string,
  ): Promise<WalletResult>;
  credit(
    playerId: string,
    amount: Money,
    roundId: string,
    betId: string,
  ): Promise<WalletResult>;
  getBalance(playerId: string): Promise<Money>;
}
