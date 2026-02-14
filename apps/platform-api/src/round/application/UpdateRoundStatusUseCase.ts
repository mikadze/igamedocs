import { InvalidStateTransition, InvalidCrashPointError } from '@shared/kernel/DomainError';
import { RoundRepository } from './ports/RoundRepository';
import { RoundCache } from './ports/RoundCache';
import { UpdateRoundStatusCommand } from './commands/UpdateRoundStatusCommand';
import { UpdateRoundStatusResult } from './commands/UpdateRoundStatusResult';

const SETTLED_ROUND_CACHE_TTL = 300;

export class UpdateRoundStatusUseCase {
  constructor(
    private readonly roundRepo: RoundRepository,
    private readonly roundCache: RoundCache,
  ) {}

  async execute(command: UpdateRoundStatusCommand): Promise<UpdateRoundStatusResult> {
    const round = await this.roundRepo.findById(command.roundId);
    if (!round) {
      return { success: false, error: 'ROUND_NOT_FOUND' };
    }

    try {
      round.transitionTo(command.status);
    } catch (e) {
      if (e instanceof InvalidStateTransition) {
        return { success: false, error: 'INVALID_TRANSITION' };
      }
      throw e;
    }

    if (command.status === 'CRASHED' && command.crashPoint) {
      try {
        round.recordCrash(command.crashPoint);
      } catch (e) {
        if (e instanceof InvalidCrashPointError) {
          return { success: false, error: 'INVALID_CRASH_POINT' };
        }
        throw e;
      }
      await this.roundRepo.recordCrashPoint(command.roundId, command.crashPoint);
    }

    const updated = await this.roundRepo.updateStatus(round);
    if (!updated) {
      return { success: false, error: 'ROUND_NOT_FOUND' };
    }

    if (command.status === 'SETTLED') {
      await this.roundCache.clearCurrentRound(round.operatorId);
      await this.roundCache.cacheSettledRound(updated, SETTLED_ROUND_CACHE_TTL);
    } else if (command.status === 'CRASHED') {
      await this.roundCache.cacheSettledRound(updated, SETTLED_ROUND_CACHE_TTL);
      await this.roundCache.setCurrentRound(round.operatorId, updated);
    } else {
      await this.roundCache.setCurrentRound(round.operatorId, updated);
    }

    return { success: true, round: updated };
  }
}
