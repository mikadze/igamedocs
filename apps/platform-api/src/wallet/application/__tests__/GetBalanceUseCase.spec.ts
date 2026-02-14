import { GetBalanceUseCase } from '../GetBalanceUseCase';
import { OperatorWalletGateway } from '../ports/OperatorWalletGateway';
import { BalanceCache } from '../ports/BalanceCache';
import { Money } from '@shared/kernel/Money';

describe('GetBalanceUseCase', () => {
  let gateway: jest.Mocked<OperatorWalletGateway>;
  let balanceCache: jest.Mocked<BalanceCache>;
  let useCase: GetBalanceUseCase;

  beforeEach(() => {
    gateway = {
      balance: jest.fn().mockResolvedValue({
        success: true,
        balance: Money.fromCents(10000),
      }),
      bet: jest.fn(),
      win: jest.fn(),
      rollback: jest.fn(),
    };
    balanceCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn(),
    };

    useCase = new GetBalanceUseCase(gateway, balanceCache);
  });

  const makeCommand = () => ({
    operatorId: 'op-1',
    operatorToken: 'op-token',
    playerId: 'player-1',
    currency: 'EUR',
  });

  it('returns cached balance without calling gateway', async () => {
    balanceCache.get.mockResolvedValue({
      balance: Money.fromCents(5000),
      currency: 'EUR',
    });

    const result = await useCase.execute(makeCommand());

    expect(result).toEqual({
      success: true,
      balance: Money.fromCents(5000),
      currency: 'EUR',
      cached: true,
    });
    expect(gateway.balance).not.toHaveBeenCalled();
  });

  it('calls gateway on cache miss and caches result', async () => {
    const result = await useCase.execute(makeCommand());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.balance.toCents()).toBe(10000);
      expect(result.cached).toBe(false);
    }
    expect(balanceCache.set).toHaveBeenCalledWith(
      'op-1', 'player-1', Money.fromCents(10000), 'EUR', 10,
    );
  });

  it('acquires lock on cache miss', async () => {
    await useCase.execute(makeCommand());

    expect(balanceCache.acquireLock).toHaveBeenCalledWith('op-1', 'player-1', 5);
  });

  it('releases lock after gateway call', async () => {
    await useCase.execute(makeCommand());

    expect(balanceCache.releaseLock).toHaveBeenCalledWith('op-1', 'player-1');
  });

  it('releases lock even on gateway failure', async () => {
    gateway.balance.mockRejectedValue(new Error('Network error'));

    await expect(useCase.execute(makeCommand())).rejects.toThrow('Network error');

    expect(balanceCache.releaseLock).toHaveBeenCalledWith('op-1', 'player-1');
  });

  it('retries cache when lock not acquired', async () => {
    balanceCache.acquireLock.mockResolvedValue(false);
    balanceCache.get
      .mockResolvedValueOnce(null) // first check
      .mockResolvedValueOnce({ balance: Money.fromCents(7000), currency: 'EUR' }); // retry after wait

    const result = await useCase.execute(makeCommand());

    expect(result).toEqual({
      success: true,
      balance: Money.fromCents(7000),
      currency: 'EUR',
      cached: true,
    });
    expect(gateway.balance).not.toHaveBeenCalled();
  });

  it('returns TIMEOUT when lock not acquired and retry misses', async () => {
    balanceCache.acquireLock.mockResolvedValue(false);

    const result = await useCase.execute(makeCommand());

    expect(result).toEqual({ success: false, error: 'TIMEOUT' });
    expect(gateway.balance).not.toHaveBeenCalled();
  });

  it('does not release lock when lock was not acquired', async () => {
    balanceCache.acquireLock.mockResolvedValue(false);

    await useCase.execute(makeCommand());

    expect(balanceCache.releaseLock).not.toHaveBeenCalled();
  });

  it('returns error on gateway error response', async () => {
    gateway.balance.mockResolvedValue({ success: false, error: 'TOKEN_EXPIRED' });

    const result = await useCase.execute(makeCommand());

    expect(result).toEqual({ success: false, error: 'TOKEN_EXPIRED' });
  });
});
