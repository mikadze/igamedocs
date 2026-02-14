import { SettleLosingBetsUseCase } from '../SettleLosingBetsUseCase';
import { BetSettlementStore } from '../ports/BetSettlementStore';

describe('SettleLosingBetsUseCase', () => {
  let betSettlementStore: jest.Mocked<BetSettlementStore>;
  let useCase: SettleLosingBetsUseCase;

  beforeEach(() => {
    betSettlementStore = {
      recordCashout: jest.fn(),
      settleLosingBets: jest.fn().mockResolvedValue(5),
    };

    useCase = new SettleLosingBetsUseCase(betSettlementStore);
  });

  it('settles losing bets and returns count', async () => {
    const result = await useCase.execute({ roundId: 'round-1' });

    expect(result).toEqual({ success: true, settledCount: 5 });
    expect(betSettlementStore.settleLosingBets).toHaveBeenCalledWith('round-1');
  });

  it('returns zero when no bets to settle', async () => {
    betSettlementStore.settleLosingBets.mockResolvedValue(0);

    const result = await useCase.execute({ roundId: 'round-1' });

    expect(result).toEqual({ success: true, settledCount: 0 });
  });
});
