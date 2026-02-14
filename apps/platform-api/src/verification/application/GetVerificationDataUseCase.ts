import { RoundLookupPort } from './ports/RoundLookupPort';
import { SeedRepository } from './ports/SeedRepository';
import { VerificationCache } from './ports/VerificationCache';
import { GetVerificationDataCommand } from './commands/GetVerificationDataCommand';
import { GetVerificationDataResult, VerificationData } from './commands/GetVerificationDataResult';

const VERIFICATION_CACHE_TTL = 3600;

export class GetVerificationDataUseCase {
  constructor(
    private readonly roundLookup: RoundLookupPort,
    private readonly seedRepo: SeedRepository,
    private readonly verificationCache: VerificationCache,
  ) {}

  async execute(command: GetVerificationDataCommand): Promise<GetVerificationDataResult> {
    const cached = await this.verificationCache.get(command.roundId);
    if (cached) {
      return { success: true, data: cached };
    }

    const round = await this.roundLookup.findById(command.roundId);
    if (!round) {
      return { success: false, error: 'ROUND_NOT_FOUND' };
    }

    const seedData = await this.seedRepo.findByRoundId(command.roundId);
    if (!seedData) {
      return { success: false, error: 'NO_SEED_DATA' };
    }

    const isComplete = round.status === 'CRASHED' || round.status === 'SETTLED';

    const result: VerificationData = isComplete
      ? {
          roundId: command.roundId,
          status: round.status,
          crashPoint: round.crashPoint,
          serverSeed: seedData.serverSeed,
          serverSeedHash: seedData.serverSeedHash,
          clientSeed: seedData.clientSeed,
          combinedHash: seedData.combinedHash,
          derivedCrashPoint: seedData.derivedCrashPoint,
          verified: true,
        }
      : {
          roundId: command.roundId,
          status: round.status,
          serverSeedHash: seedData.serverSeedHash,
          verified: false,
        };

    if (isComplete) {
      await this.verificationCache.set(command.roundId, result, VERIFICATION_CACHE_TTL);
    }

    return { success: true, data: result };
  }
}
