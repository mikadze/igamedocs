import {
  WalletTransaction,
  WalletTransactionStatus,
} from '../../domain/WalletTransaction';

export interface WalletTransactionStore {
  save(tx: WalletTransaction): Promise<void>;
  updateStatus(
    requestUuid: string,
    status: WalletTransactionStatus,
    operatorResponse: unknown,
  ): Promise<void>;
  findByRequestUuid(requestUuid: string): Promise<WalletTransaction | null>;
}
