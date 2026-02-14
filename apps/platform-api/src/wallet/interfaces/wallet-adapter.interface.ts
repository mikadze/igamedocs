export interface BalanceResponse {
  balance: number;
  currency: string;
}

export interface BetParams {
  token: string;
  requestUuid: string;
  round: string;
  amount: number;
  currency: string;
  transactionUuid: string;
}

export interface WinParams {
  token: string;
  requestUuid: string;
  round: string;
  amount: number;
  currency: string;
  transactionUuid: string;
  referenceTransactionUuid: string;
}

export interface RollbackParams {
  token: string;
  requestUuid: string;
  round: string;
  transactionUuid: string;
  referenceTransactionUuid: string;
}

export interface WalletResponse {
  status: string;
  balance: number;
}

export interface WalletAdapter {
  balance(token: string): Promise<BalanceResponse>;
  bet(params: BetParams): Promise<WalletResponse>;
  win(params: WinParams): Promise<WalletResponse>;
  rollback(params: RollbackParams): Promise<WalletResponse>;
}
