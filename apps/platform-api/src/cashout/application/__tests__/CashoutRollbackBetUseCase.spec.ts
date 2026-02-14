import { CashoutRollbackBetUseCase } from '../CashoutRollbackBetUseCase';
import { RollbackBetPort } from '../ports/RollbackBetPort';
import { Money } from '@shared/kernel/Money';

describe('CashoutRollbackBetUseCase', () => {
  let walletRollback: jest.Mocked<RollbackBetPort>;
  let useCase: CashoutRollbackBetUseCase;

  beforeEach(() => {
    walletRollback = {
      execute: jest.fn().mockResolvedValue({
        success: true,
        transactionUuid: 'rollback-tx-uuid',
        balance: Money.fromCents(10000),
      }),
    };

    useCase = new CashoutRollbackBetUseCase(walletRollback);
  });

  const makeCommand = () => ({
    operatorId: 'op-1',
    operatorToken: 'op-token',
    playerId: 'player-1',
    roundId: 'round-1',
    betTransactionUuid: 'bet-tx-uuid',
    currency: 'EUR',
  });

  it('delegates to wallet RollbackBetUseCase and returns balance', async () => {
    const result = await useCase.execute(makeCommand());

    expect(result).toEqual({ success: true, balance: Money.fromCents(10000) });
  });

  it('passes correct params to wallet rollback', async () => {
    await useCase.execute(makeCommand());

    expect(walletRollback.execute).toHaveBeenCalledWith({
      operatorId: 'op-1',
      operatorToken: 'op-token',
      playerId: 'player-1',
      roundId: 'round-1',
      referenceTransactionUuid: 'bet-tx-uuid',
      currency: 'EUR',
    });
  });

  it('propagates wallet error', async () => {
    walletRollback.execute.mockResolvedValue({
      success: false,
      error: 'TIMEOUT',
    });

    const result = await useCase.execute(makeCommand());

    expect(result).toEqual({ success: false, error: 'TIMEOUT' });
  });
});
