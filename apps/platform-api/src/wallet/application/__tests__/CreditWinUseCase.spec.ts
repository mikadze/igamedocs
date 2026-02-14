import { CreditWinUseCase } from '../CreditWinUseCase';
import { OperatorWalletGateway } from '../ports/OperatorWalletGateway';
import { WalletTransactionStore } from '../ports/WalletTransactionStore';
import { BalanceCache } from '../ports/BalanceCache';
import { Money } from '@shared/kernel/Money';
import { WalletResult } from '../../domain/WalletResult';
import { WalletTransactionStatus } from '../../domain/WalletTransaction';

describe('CreditWinUseCase', () => {
  let gateway: jest.Mocked<OperatorWalletGateway>;
  let txStore: jest.Mocked<WalletTransactionStore>;
  let balanceCache: jest.Mocked<BalanceCache>;
  let useCase: CreditWinUseCase;

  const successResult: WalletResult = {
    success: true,
    balance: Money.fromCents(15000),
  };

  beforeEach(() => {
    gateway = {
      balance: jest.fn(),
      bet: jest.fn(),
      win: jest.fn().mockResolvedValue(successResult),
      rollback: jest.fn(),
    };
    txStore = {
      save: jest.fn(),
      updateStatus: jest.fn(),
      findByRequestUuid: jest.fn(),
    };
    balanceCache = {
      get: jest.fn(),
      set: jest.fn(),
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
    };

    useCase = new CreditWinUseCase(gateway, txStore, balanceCache);
  });

  const makeCommand = () => ({
    operatorId: 'op-1',
    operatorToken: 'op-token',
    playerId: 'player-1',
    roundId: 'round-1',
    amount: Money.fromCents(5000),
    currency: 'EUR',
    referenceTransactionUuid: 'bet-tx-uuid',
  });

  it('returns success with balance on successful credit', async () => {
    const result = await useCase.execute(makeCommand());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.balance.toCents()).toBe(15000);
      expect(result.transactionUuid).toBeDefined();
    }
  });

  it('passes referenceTransactionUuid to gateway', async () => {
    await useCase.execute(makeCommand());

    expect(gateway.win).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceTransactionUuid: 'bet-tx-uuid',
      }),
    );
  });

  it('updates transaction to COMPLETED on success', async () => {
    await useCase.execute(makeCommand());

    expect(txStore.updateStatus).toHaveBeenCalledWith(
      expect.any(String),
      WalletTransactionStatus.COMPLETED,
      successResult,
    );
  });

  it('updates balance cache on success', async () => {
    await useCase.execute(makeCommand());

    expect(balanceCache.set).toHaveBeenCalledWith(
      'op-1', 'player-1', Money.fromCents(15000), 'EUR', 10,
    );
  });

  it('returns error on gateway failure', async () => {
    gateway.win.mockResolvedValue({ success: false, error: 'TOKEN_EXPIRED' });

    const result = await useCase.execute(makeCommand());

    expect(result).toEqual({ success: false, error: 'TOKEN_EXPIRED' });
  });

  it('marks transaction FAILED on gateway failure', async () => {
    gateway.win.mockResolvedValue({ success: false, error: 'TIMEOUT' });

    await useCase.execute(makeCommand());

    expect(txStore.updateStatus).toHaveBeenCalledWith(
      expect.any(String),
      WalletTransactionStatus.FAILED,
      { success: false, error: 'TIMEOUT' },
    );
  });
});
