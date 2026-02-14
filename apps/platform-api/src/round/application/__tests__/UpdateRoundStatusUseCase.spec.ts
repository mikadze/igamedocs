import { UpdateRoundStatusUseCase } from '../UpdateRoundStatusUseCase';
import { RoundRepository } from '../ports/RoundRepository';
import { RoundCache } from '../ports/RoundCache';
import { RoundRecord } from '../../domain/RoundRecord';

describe('UpdateRoundStatusUseCase', () => {
  let roundRepo: jest.Mocked<RoundRepository>;
  let roundCache: jest.Mocked<RoundCache>;
  let useCase: UpdateRoundStatusUseCase;

  const makeWaitingRound = () => RoundRecord.create('round-1', 'op-1', 10000);

  beforeEach(() => {
    roundRepo = {
      save: jest.fn(),
      updateStatus: jest.fn().mockImplementation(async (round: RoundRecord) => round),
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

    useCase = new UpdateRoundStatusUseCase(roundRepo, roundCache);
  });

  it('transitions round to BETTING successfully', async () => {
    roundRepo.findById.mockResolvedValue(makeWaitingRound());

    const result = await useCase.execute({ roundId: 'round-1', status: 'BETTING' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.round.status).toBe('BETTING');
    }
  });

  it('returns ROUND_NOT_FOUND when round does not exist', async () => {
    roundRepo.findById.mockResolvedValue(null);

    const result = await useCase.execute({ roundId: 'missing', status: 'BETTING' });

    expect(result).toEqual({ success: false, error: 'ROUND_NOT_FOUND' });
  });

  it('returns INVALID_TRANSITION for invalid state transition', async () => {
    roundRepo.findById.mockResolvedValue(makeWaitingRound());

    const result = await useCase.execute({ roundId: 'round-1', status: 'CRASHED' });

    expect(result).toEqual({ success: false, error: 'INVALID_TRANSITION' });
  });

  it('records crash point on CRASHED transition', async () => {
    const round = makeWaitingRound();
    round.transitionTo('BETTING');
    round.transitionTo('FLYING');
    roundRepo.findById.mockResolvedValue(round);

    await useCase.execute({ roundId: 'round-1', status: 'CRASHED', crashPoint: '2.50' });

    expect(roundRepo.recordCrashPoint).toHaveBeenCalledWith('round-1', '2.50');
  });

  it('returns INVALID_CRASH_POINT for crash point below 1.0', async () => {
    const round = makeWaitingRound();
    round.transitionTo('BETTING');
    round.transitionTo('FLYING');
    roundRepo.findById.mockResolvedValue(round);

    const result = await useCase.execute({ roundId: 'round-1', status: 'CRASHED', crashPoint: '0.50' });

    expect(result).toEqual({ success: false, error: 'INVALID_CRASH_POINT' });
  });

  it('clears current round and caches settled on SETTLED', async () => {
    const round = makeWaitingRound();
    round.transitionTo('BETTING');
    round.transitionTo('FLYING');
    round.transitionTo('CRASHED');
    round.recordCrash('2.00');
    roundRepo.findById.mockResolvedValue(round);

    await useCase.execute({ roundId: 'round-1', status: 'SETTLED' });

    expect(roundCache.clearCurrentRound).toHaveBeenCalledWith('op-1');
    expect(roundCache.cacheSettledRound).toHaveBeenCalled();
  });

  it('updates current round in cache for non-terminal transitions', async () => {
    roundRepo.findById.mockResolvedValue(makeWaitingRound());

    await useCase.execute({ roundId: 'round-1', status: 'BETTING' });

    expect(roundCache.setCurrentRound).toHaveBeenCalled();
  });
});
