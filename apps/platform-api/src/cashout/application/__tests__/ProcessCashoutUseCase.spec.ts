import { ProcessCashoutUseCase } from '../ProcessCashoutUseCase';
import { CreditWinPort } from '../ports/CreditWinPort';
import { BetSettlementStore } from '../ports/BetSettlementStore';
import { Logger } from '@shared/ports/Logger';
import { Money } from '@shared/kernel/Money';

describe('ProcessCashoutUseCase', () => {
  let creditWin: jest.Mocked<CreditWinPort>;
  let betSettlementStore: jest.Mocked<BetSettlementStore>;
  let logger: jest.Mocked<Logger>;
  let useCase: ProcessCashoutUseCase;

  beforeEach(() => {
    creditWin = {
      execute: jest.fn().mockResolvedValue({
        success: true,
        transactionUuid: 'win-tx-uuid',
        balance: Money.fromCents(15000),
      }),
    };

    betSettlementStore = {
      recordCashout: jest.fn(),
      settleLosingBets: jest.fn(),
    };

    logger = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    useCase = new ProcessCashoutUseCase(creditWin, betSettlementStore, logger);
  });

  const makeCommand = () => ({
    operatorId: 'op-1',
    operatorToken: 'op-token',
    playerId: 'player-1',
    roundId: 'round-1',
    betId: 'bet-1',
    betAmount: Money.fromCents(1000),
    cashoutMultiplier: 2.5,
    currency: 'EUR',
    betTransactionUuid: 'bet-tx-uuid',
  });

  it('calculates payout and credits win successfully', async () => {
    const result = await useCase.execute(makeCommand());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payout.toCents()).toBe(2500); // 1000 * 2.5
      expect(result.balance.toCents()).toBe(15000);
    }
  });

  it('delegates to CreditWinUseCase with correct payout amount', async () => {
    await useCase.execute(makeCommand());

    expect(creditWin.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: Money.fromCents(2500),
        referenceTransactionUuid: 'bet-tx-uuid',
      }),
    );
  });

  it('records cashout on bet after successful credit', async () => {
    await useCase.execute(makeCommand());

    expect(betSettlementStore.recordCashout).toHaveBeenCalledWith(
      'bet-1', '2.5', '25.00',
    );
  });

  it('returns INVALID_MULTIPLIER for multiplier below 1.0', async () => {
    const result = await useCase.execute({ ...makeCommand(), cashoutMultiplier: 0.5 });

    expect(result).toEqual({ success: false, error: 'INVALID_MULTIPLIER' });
    expect(creditWin.execute).not.toHaveBeenCalled();
  });

  it('propagates wallet error from CreditWinUseCase', async () => {
    creditWin.execute.mockResolvedValue({
      success: false,
      error: 'INSUFFICIENT_FUNDS',
    });

    const result = await useCase.execute(makeCommand());

    expect(result).toEqual({ success: false, error: 'INSUFFICIENT_FUNDS' });
    expect(betSettlementStore.recordCashout).not.toHaveBeenCalled();
  });

  it('uses floor rounding for payout (1000 * 1.33 = 1330 cents)', async () => {
    const result = await useCase.execute({ ...makeCommand(), cashoutMultiplier: 1.33 });

    if (result.success) {
      expect(result.payout.toCents()).toBe(1330);
    }
  });

  it('returns success and logs error when recordCashout fails after credit', async () => {
    betSettlementStore.recordCashout.mockRejectedValue(new Error('DB connection lost'));

    const result = await useCase.execute(makeCommand());

    expect(result.success).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to record cashout after successful credit',
      expect.objectContaining({ betId: 'bet-1', roundId: 'round-1' }),
    );
  });
});
