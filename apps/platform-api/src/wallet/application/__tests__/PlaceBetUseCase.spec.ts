import { PlaceBetUseCase } from '../PlaceBetUseCase';
import { OperatorWalletGateway } from '../ports/OperatorWalletGateway';
import { WalletTransactionStore } from '../ports/WalletTransactionStore';
import { BalanceCache } from '../ports/BalanceCache';
import { Money } from '@shared/kernel/Money';
import { WalletResult } from '../../domain/WalletResult';
import { WalletTransactionStatus } from '../../domain/WalletTransaction';

describe('PlaceBetUseCase', () => {
  let gateway: jest.Mocked<OperatorWalletGateway>;
  let txStore: jest.Mocked<WalletTransactionStore>;
  let balanceCache: jest.Mocked<BalanceCache>;
  let useCase: PlaceBetUseCase;

  const successResult: WalletResult = {
    success: true,
    balance: Money.fromCents(9000),
  };

  beforeEach(() => {
    gateway = {
      balance: jest.fn(),
      bet: jest.fn().mockResolvedValue(successResult),
      win: jest.fn(),
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

    useCase = new PlaceBetUseCase(gateway, txStore, balanceCache);
  });

  const makeCommand = () => ({
    operatorId: 'op-1',
    operatorToken: 'op-token',
    playerId: 'player-1',
    roundId: 'round-1',
    amount: Money.fromCents(1000),
    currency: 'EUR',
  });

  it('returns success with transaction UUID and balance', async () => {
    const result = await useCase.execute(makeCommand());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transactionUuid).toBeDefined();
      expect(result.balance.toCents()).toBe(9000);
    }
  });

  it('saves PENDING transaction before calling gateway', async () => {
    let saveCalledBeforeGateway = false;
    txStore.save.mockImplementation(async () => {
      saveCalledBeforeGateway = !gateway.bet.mock.calls.length;
    });

    await useCase.execute(makeCommand());

    expect(saveCalledBeforeGateway).toBe(true);
  });

  it('calls gateway.bet with correct params', async () => {
    await useCase.execute(makeCommand());

    expect(gateway.bet).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'op-token',
        roundId: 'round-1',
        amount: Money.fromCents(1000),
        currency: 'EUR',
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
      'op-1', 'player-1', Money.fromCents(9000), 'EUR', 10,
    );
  });

  it('returns error and marks FAILED on gateway failure', async () => {
    gateway.bet.mockResolvedValue({ success: false, error: 'INSUFFICIENT_FUNDS' });

    const result = await useCase.execute(makeCommand());

    expect(result).toEqual({ success: false, error: 'INSUFFICIENT_FUNDS' });
    expect(txStore.updateStatus).toHaveBeenCalledWith(
      expect.any(String),
      WalletTransactionStatus.FAILED,
      { success: false, error: 'INSUFFICIENT_FUNDS' },
    );
  });

  it('handles PLAYER_BLOCKED error', async () => {
    gateway.bet.mockResolvedValue({ success: false, error: 'PLAYER_BLOCKED' });

    const result = await useCase.execute(makeCommand());

    expect(result).toEqual({ success: false, error: 'PLAYER_BLOCKED' });
  });

  it('handles TIMEOUT error', async () => {
    gateway.bet.mockResolvedValue({ success: false, error: 'TIMEOUT' });

    const result = await useCase.execute(makeCommand());

    expect(result).toEqual({ success: false, error: 'TIMEOUT' });
  });

  it('does not update balance cache on failure', async () => {
    gateway.bet.mockResolvedValue({ success: false, error: 'INSUFFICIENT_FUNDS' });

    await useCase.execute(makeCommand());

    expect(balanceCache.set).not.toHaveBeenCalled();
  });
});
