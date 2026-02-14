import { RollbackBetUseCase } from '../RollbackBetUseCase';
import { OperatorWalletGateway } from '../ports/OperatorWalletGateway';
import { WalletTransactionStore } from '../ports/WalletTransactionStore';
import { Money } from '@shared/kernel/Money';
import { WalletResult } from '../../domain/WalletResult';
import { WalletTransactionStatus } from '../../domain/WalletTransaction';

describe('RollbackBetUseCase', () => {
  let gateway: jest.Mocked<OperatorWalletGateway>;
  let txStore: jest.Mocked<WalletTransactionStore>;
  let useCase: RollbackBetUseCase;

  const successResult: WalletResult = {
    success: true,
    balance: Money.fromCents(10000),
  };

  beforeEach(() => {
    gateway = {
      balance: jest.fn(),
      bet: jest.fn(),
      win: jest.fn(),
      rollback: jest.fn().mockResolvedValue(successResult),
    };
    txStore = {
      save: jest.fn(),
      updateStatus: jest.fn(),
      findByRequestUuid: jest.fn(),
    };

    useCase = new RollbackBetUseCase(gateway, txStore);
  });

  const makeCommand = () => ({
    operatorId: 'op-1',
    operatorToken: 'op-token',
    playerId: 'player-1',
    roundId: 'round-1',
    referenceTransactionUuid: 'bet-tx-uuid',
    currency: 'EUR',
  });

  it('returns success with balance on successful rollback', async () => {
    const result = await useCase.execute(makeCommand());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.balance.toCents()).toBe(10000);
    }
  });

  it('creates transaction with Money.zero() amount', async () => {
    await useCase.execute(makeCommand());

    const [savedTx] = txStore.save.mock.calls[0];
    expect(savedTx.amount.toCents()).toBe(0);
  });

  it('passes referenceTransactionUuid to gateway', async () => {
    await useCase.execute(makeCommand());

    expect(gateway.rollback).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceTransactionUuid: 'bet-tx-uuid',
      }),
    );
  });

  it('updates transaction to ROLLED_BACK on success', async () => {
    await useCase.execute(makeCommand());

    expect(txStore.updateStatus).toHaveBeenCalledWith(
      expect.any(String),
      WalletTransactionStatus.ROLLED_BACK,
      successResult,
    );
  });

  it('returns error and marks FAILED on gateway failure', async () => {
    gateway.rollback.mockResolvedValue({ success: false, error: 'TIMEOUT' });

    const result = await useCase.execute(makeCommand());

    expect(result).toEqual({ success: false, error: 'TIMEOUT' });
    expect(txStore.updateStatus).toHaveBeenCalledWith(
      expect.any(String),
      WalletTransactionStatus.FAILED,
      { success: false, error: 'TIMEOUT' },
    );
  });
});
