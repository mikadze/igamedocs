import { Money } from '@shared/kernel/Money';
import { WalletResult } from '../../domain/WalletResult';

export interface OperatorWalletGateway {
  balance(operatorToken: string): Promise<WalletResult>;

  bet(params: {
    token: string;
    requestUuid: string;
    transactionUuid: string;
    roundId: string;
    amount: Money;
    currency: string;
  }): Promise<WalletResult>;

  win(params: {
    token: string;
    requestUuid: string;
    transactionUuid: string;
    referenceTransactionUuid: string;
    roundId: string;
    amount: Money;
    currency: string;
  }): Promise<WalletResult>;

  rollback(params: {
    token: string;
    requestUuid: string;
    transactionUuid: string;
    referenceTransactionUuid: string;
    roundId: string;
  }): Promise<WalletResult>;
}
