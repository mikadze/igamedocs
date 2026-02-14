import { GetPlayerBetHistoryUseCase } from '../GetPlayerBetHistoryUseCase';
import { BetQueryRepository } from '../ports/BetQueryRepository';
import { BetSummary } from '../ports/RoundQueryRepository';
import { PaginatedResult } from '@shared/types/PaginatedResult';

describe('GetPlayerBetHistoryUseCase', () => {
  let betQueryRepo: jest.Mocked<BetQueryRepository>;
  let useCase: GetPlayerBetHistoryUseCase;

  const makeBet = (id: string): BetSummary => ({
    id,
    roundId: 'round-1',
    operatorPlayerId: 'player-1',
    amount: '1000',
    autoCashoutAt: null,
    cashoutMultiplier: null,
    payout: null,
    status: 'PLACED',
    createdAt: new Date(),
  });

  const makePage = (ids: string[]): PaginatedResult<BetSummary> => ({
    data: ids.map(makeBet),
    hasMore: false,
    nextCursor: null,
  });

  beforeEach(() => {
    betQueryRepo = {
      findByPlayerPaginated: jest.fn(),
      findByRoundId: jest.fn(),
    };

    useCase = new GetPlayerBetHistoryUseCase(betQueryRepo);
  });

  it('delegates to bet query repository', async () => {
    const page = makePage(['b-1', 'b-2']);
    betQueryRepo.findByPlayerPaginated.mockResolvedValue(page);

    const result = await useCase.execute({ operatorPlayerId: 'player-1' });

    expect(result).toBe(page);
    expect(betQueryRepo.findByPlayerPaginated).toHaveBeenCalledWith(
      'player-1', undefined, 20,
    );
  });

  it('passes cursor and limit through', async () => {
    betQueryRepo.findByPlayerPaginated.mockResolvedValue(makePage([]));

    const cursor = { ts: '2024-01-01', id: 'b-5' };
    await useCase.execute({ operatorPlayerId: 'player-1', cursor, limit: 10 });

    expect(betQueryRepo.findByPlayerPaginated).toHaveBeenCalledWith(
      'player-1', cursor, 10,
    );
  });

  it('applies default page size of 20 when limit not provided', async () => {
    betQueryRepo.findByPlayerPaginated.mockResolvedValue(makePage([]));

    await useCase.execute({ operatorPlayerId: 'player-1' });

    expect(betQueryRepo.findByPlayerPaginated).toHaveBeenCalledWith(
      'player-1', undefined, 20,
    );
  });
});
