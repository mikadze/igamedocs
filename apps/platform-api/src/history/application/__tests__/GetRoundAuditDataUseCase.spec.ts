import { GetRoundAuditDataUseCase } from '../GetRoundAuditDataUseCase';
import { RoundQueryRepository, RoundAuditData } from '../ports/RoundQueryRepository';

describe('GetRoundAuditDataUseCase', () => {
  let roundQueryRepo: jest.Mocked<RoundQueryRepository>;
  let useCase: GetRoundAuditDataUseCase;

  const makeAuditData = (): RoundAuditData => ({
    round: {
      id: 'round-1',
      operatorId: 'op-1',
      status: 'SETTLED',
      crashPoint: '2.50',
      bettingWindowMs: 10000,
      startedAt: new Date(),
      crashedAt: new Date(),
      settledAt: new Date(),
      createdAt: new Date(),
    },
    bets: [
      {
        id: 'bet-1',
        roundId: 'round-1',
        operatorPlayerId: 'player-1',
        amount: '1000',
        autoCashoutAt: null,
        cashoutMultiplier: '2.5',
        payout: '2500',
        status: 'WON',
        createdAt: new Date(),
      },
    ],
    seeds: {
      serverSeed: 'server-seed',
      serverSeedHash: 'hash-abc',
      clientSeed: 'client-seed',
      combinedHash: 'combined-hash',
      derivedCrashPoint: '2.50',
    },
  });

  beforeEach(() => {
    roundQueryRepo = {
      findPaginated: jest.fn(),
      findById: jest.fn(),
      findAuditData: jest.fn(),
    };

    useCase = new GetRoundAuditDataUseCase(roundQueryRepo);
  });

  it('returns audit data on success', async () => {
    const auditData = makeAuditData();
    roundQueryRepo.findAuditData.mockResolvedValue(auditData);

    const result = await useCase.execute({ roundId: 'round-1' });

    expect(result).toEqual({ success: true, data: auditData });
  });

  it('returns ROUND_NOT_FOUND when round does not exist', async () => {
    roundQueryRepo.findAuditData.mockResolvedValue(null);

    const result = await useCase.execute({ roundId: 'nonexistent' });

    expect(result).toEqual({ success: false, error: 'ROUND_NOT_FOUND' });
  });
});
