import { GetVerificationDataUseCase } from '../GetVerificationDataUseCase';
import { RoundLookupPort } from '../ports/RoundLookupPort';
import { RoundSummary } from '@shared/types/RoundSummary';
import { SeedData } from '@shared/types/SeedData';
import { SeedRepository } from '../ports/SeedRepository';
import { VerificationCache } from '../ports/VerificationCache';
import { VerificationData } from '../commands/GetVerificationDataResult';

describe('GetVerificationDataUseCase', () => {
  let roundLookup: jest.Mocked<RoundLookupPort>;
  let seedRepo: jest.Mocked<SeedRepository>;
  let verificationCache: jest.Mocked<VerificationCache>;
  let useCase: GetVerificationDataUseCase;

  const makeRound = (status: string, crashPoint: string | null = null): RoundSummary => ({
    id: 'round-1',
    operatorId: 'op-1',
    status,
    crashPoint,
    bettingWindowMs: 10000,
    startedAt: new Date(),
    crashedAt: crashPoint ? new Date() : null,
    settledAt: status === 'SETTLED' ? new Date() : null,
    createdAt: new Date(),
  });

  const makeSeedData = (): SeedData => ({
    serverSeed: 'server-seed-abc',
    serverSeedHash: 'hash-abc',
    clientSeed: 'client-seed-xyz',
    combinedHash: 'combined-hash',
    derivedCrashPoint: '2.50',
  });

  beforeEach(() => {
    roundLookup = {
      findById: jest.fn(),
    };

    seedRepo = {
      findByRoundId: jest.fn(),
    };

    verificationCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
    };

    useCase = new GetVerificationDataUseCase(roundLookup, seedRepo, verificationCache);
  });

  it('returns cached verification data when available', async () => {
    const cached: VerificationData = {
      roundId: 'round-1',
      status: 'CRASHED',
      crashPoint: '2.50',
      serverSeed: 'seed',
      serverSeedHash: 'hash',
      clientSeed: 'client',
      combinedHash: 'combined',
      derivedCrashPoint: '2.50',
      verified: true,
    };
    verificationCache.get.mockResolvedValue(cached);

    const result = await useCase.execute({ roundId: 'round-1' });

    expect(result).toEqual({ success: true, data: cached });
    expect(roundLookup.findById).not.toHaveBeenCalled();
  });

  it('returns ROUND_NOT_FOUND when round does not exist', async () => {
    roundLookup.findById.mockResolvedValue(null);

    const result = await useCase.execute({ roundId: 'nonexistent' });

    expect(result).toEqual({ success: false, error: 'ROUND_NOT_FOUND' });
  });

  it('returns NO_SEED_DATA when seeds are not found', async () => {
    roundLookup.findById.mockResolvedValue(makeRound('CRASHED', '2.50'));
    seedRepo.findByRoundId.mockResolvedValue(null);

    const result = await useCase.execute({ roundId: 'round-1' });

    expect(result).toEqual({ success: false, error: 'NO_SEED_DATA' });
  });

  it('returns full verification data for completed round (CRASHED)', async () => {
    roundLookup.findById.mockResolvedValue(makeRound('CRASHED', '2.50'));
    seedRepo.findByRoundId.mockResolvedValue(makeSeedData());

    const result = await useCase.execute({ roundId: 'round-1' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verified).toBe(true);
      if (result.data.verified) {
        expect(result.data.serverSeed).toBe('server-seed-abc');
        expect(result.data.clientSeed).toBe('client-seed-xyz');
        expect(result.data.combinedHash).toBe('combined-hash');
        expect(result.data.derivedCrashPoint).toBe('2.50');
      }
    }
  });

  it('returns hash-only data for active round (FLYING)', async () => {
    roundLookup.findById.mockResolvedValue(makeRound('FLYING'));
    seedRepo.findByRoundId.mockResolvedValue(makeSeedData());

    const result = await useCase.execute({ roundId: 'round-1' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verified).toBe(false);
      expect(result.data.serverSeedHash).toBe('hash-abc');
      expect(result.data).not.toHaveProperty('serverSeed');
      expect(result.data).not.toHaveProperty('clientSeed');
    }
  });

  it('caches completed round verification data', async () => {
    roundLookup.findById.mockResolvedValue(makeRound('SETTLED', '1.50'));
    seedRepo.findByRoundId.mockResolvedValue(makeSeedData());

    await useCase.execute({ roundId: 'round-1' });

    expect(verificationCache.set).toHaveBeenCalledWith(
      'round-1',
      expect.objectContaining({ verified: true }),
      3600,
    );
  });

  it('does not cache active round verification data', async () => {
    roundLookup.findById.mockResolvedValue(makeRound('BETTING'));
    seedRepo.findByRoundId.mockResolvedValue(makeSeedData());

    await useCase.execute({ roundId: 'round-1' });

    expect(verificationCache.set).not.toHaveBeenCalled();
  });
});
