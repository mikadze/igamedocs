import { GetRoundHistoryUseCase } from '../GetRoundHistoryUseCase';
import { RoundQueryRepository, RoundSummary } from '../ports/RoundQueryRepository';
import { HistoryCache } from '../ports/HistoryCache';
import { PaginatedResult } from '@shared/types/PaginatedResult';

describe('GetRoundHistoryUseCase', () => {
  let roundQueryRepo: jest.Mocked<RoundQueryRepository>;
  let historyCache: jest.Mocked<HistoryCache>;
  let useCase: GetRoundHistoryUseCase;

  const makeSummary = (id: string): RoundSummary => ({
    id,
    operatorId: 'op-1',
    status: 'SETTLED',
    crashPoint: '2.50',
    bettingWindowMs: 10000,
    startedAt: new Date(),
    crashedAt: new Date(),
    settledAt: new Date(),
    createdAt: new Date(),
  });

  const makePage = (ids: string[]): PaginatedResult<RoundSummary> => ({
    data: ids.map(makeSummary),
    hasMore: false,
    nextCursor: null,
  });

  beforeEach(() => {
    roundQueryRepo = {
      findPaginated: jest.fn(),
      findById: jest.fn(),
      findAuditData: jest.fn(),
    };

    historyCache = {
      getRoundHistoryPage1: jest.fn().mockResolvedValue(null),
      setRoundHistoryPage1: jest.fn(),
    };

    useCase = new GetRoundHistoryUseCase(roundQueryRepo, historyCache);
  });

  it('returns cached page 1 when available', async () => {
    const cached = makePage(['r-1', 'r-2']);
    historyCache.getRoundHistoryPage1.mockResolvedValue(cached);

    const result = await useCase.execute({ operatorId: 'op-1' });

    expect(result).toBe(cached);
    expect(roundQueryRepo.findPaginated).not.toHaveBeenCalled();
  });

  it('queries repo and caches page 1 on cache miss', async () => {
    const page = makePage(['r-1']);
    roundQueryRepo.findPaginated.mockResolvedValue(page);

    const result = await useCase.execute({ operatorId: 'op-1' });

    expect(result).toBe(page);
    expect(historyCache.setRoundHistoryPage1).toHaveBeenCalledWith('op-1', page, 60);
  });

  it('does not use cache for cursor-based pages', async () => {
    const page = makePage(['r-3']);
    roundQueryRepo.findPaginated.mockResolvedValue(page);

    const result = await useCase.execute({
      operatorId: 'op-1',
      cursor: { ts: '2024-01-01', id: 'r-2' },
    });

    expect(result).toBe(page);
    expect(historyCache.getRoundHistoryPage1).not.toHaveBeenCalled();
    expect(historyCache.setRoundHistoryPage1).not.toHaveBeenCalled();
  });

  it('applies default page size of 20 when limit not provided', async () => {
    roundQueryRepo.findPaginated.mockResolvedValue(makePage([]));

    await useCase.execute({ operatorId: 'op-1' });

    expect(roundQueryRepo.findPaginated).toHaveBeenCalledWith('op-1', undefined, 20);
  });

  it('uses custom limit when provided', async () => {
    roundQueryRepo.findPaginated.mockResolvedValue(makePage([]));

    await useCase.execute({ operatorId: 'op-1', limit: 10 });

    expect(roundQueryRepo.findPaginated).toHaveBeenCalledWith('op-1', undefined, 10);
  });
});
