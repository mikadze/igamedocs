import { CreateRoundUseCase } from '../CreateRoundUseCase';
import { RoundRepository } from '../ports/RoundRepository';
import { RoundCache } from '../ports/RoundCache';
import { RoundRecord } from '../../domain/RoundRecord';

describe('CreateRoundUseCase', () => {
  let roundRepo: jest.Mocked<RoundRepository>;
  let roundCache: jest.Mocked<RoundCache>;
  let useCase: CreateRoundUseCase;

  beforeEach(() => {
    roundRepo = {
      save: jest.fn().mockImplementation(async (round: RoundRecord) => round),
      updateStatus: jest.fn(),
      recordCrashPoint: jest.fn(),
      findById: jest.fn(),
      findCurrentByOperatorId: jest.fn(),
    };
    roundCache = {
      getCurrentRound: jest.fn(),
      setCurrentRound: jest.fn(),
      clearCurrentRound: jest.fn(),
      cacheSettledRound: jest.fn(),
      getById: jest.fn(),
    };

    useCase = new CreateRoundUseCase(roundRepo, roundCache);
  });

  it('creates a round and returns success', async () => {
    const result = await useCase.execute({ operatorId: 'op-1' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.round.operatorId).toBe('op-1');
      expect(result.round.status).toBe('WAITING');
    }
  });

  it('saves round to repository', async () => {
    await useCase.execute({ operatorId: 'op-1' });

    expect(roundRepo.save).toHaveBeenCalledTimes(1);
  });

  it('sets round as current in cache', async () => {
    await useCase.execute({ operatorId: 'op-1' });

    expect(roundCache.setCurrentRound).toHaveBeenCalledWith('op-1', expect.any(RoundRecord));
  });

  it('uses default betting window when not specified', async () => {
    const result = await useCase.execute({ operatorId: 'op-1' });

    if (result.success) {
      expect(result.round.bettingWindowMs).toBe(10000);
    }
  });

  it('uses custom betting window when specified', async () => {
    const result = await useCase.execute({ operatorId: 'op-1', bettingWindowMs: 5000 });

    if (result.success) {
      expect(result.round.bettingWindowMs).toBe(5000);
    }
  });
});
