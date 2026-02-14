import { GetCurrentRoundUseCase } from '../GetCurrentRoundUseCase';
import { RoundRepository } from '../ports/RoundRepository';
import { RoundCache } from '../ports/RoundCache';
import { RoundRecord } from '../../domain/RoundRecord';

describe('GetCurrentRoundUseCase', () => {
  let roundRepo: jest.Mocked<RoundRepository>;
  let roundCache: jest.Mocked<RoundCache>;
  let useCase: GetCurrentRoundUseCase;

  beforeEach(() => {
    roundRepo = {
      save: jest.fn(),
      updateStatus: jest.fn(),
      recordCrashPoint: jest.fn(),
      findById: jest.fn(),
      findCurrentByOperatorId: jest.fn(),
    };
    roundCache = {
      getCurrentRound: jest.fn().mockResolvedValue(null),
      setCurrentRound: jest.fn(),
      clearCurrentRound: jest.fn(),
      cacheSettledRound: jest.fn(),
      getById: jest.fn(),
    };

    useCase = new GetCurrentRoundUseCase(roundRepo, roundCache);
  });

  it('returns cached round without hitting DB', async () => {
    const round = RoundRecord.create('round-1', 'op-1', 10000);
    roundCache.getCurrentRound.mockResolvedValue(round);

    const result = await useCase.execute({ operatorId: 'op-1' });

    expect(result).toEqual({ success: true, round });
    expect(roundRepo.findCurrentByOperatorId).not.toHaveBeenCalled();
  });

  it('falls back to DB on cache miss', async () => {
    const round = RoundRecord.create('round-1', 'op-1', 10000);
    roundRepo.findCurrentByOperatorId.mockResolvedValue(round);

    const result = await useCase.execute({ operatorId: 'op-1' });

    expect(result).toEqual({ success: true, round });
  });

  it('populates cache on DB hit', async () => {
    const round = RoundRecord.create('round-1', 'op-1', 10000);
    roundRepo.findCurrentByOperatorId.mockResolvedValue(round);

    await useCase.execute({ operatorId: 'op-1' });

    expect(roundCache.setCurrentRound).toHaveBeenCalledWith('op-1', round);
  });

  it('returns NO_ACTIVE_ROUND when both cache and DB miss', async () => {
    roundRepo.findCurrentByOperatorId.mockResolvedValue(null);

    const result = await useCase.execute({ operatorId: 'op-1' });

    expect(result).toEqual({ success: false, error: 'NO_ACTIVE_ROUND' });
  });
});
