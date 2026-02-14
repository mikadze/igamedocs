import { RoundRepository } from './ports/RoundRepository';
import { RoundCache } from './ports/RoundCache';
import { GetCurrentRoundCommand } from './commands/GetCurrentRoundCommand';
import { GetCurrentRoundResult } from './commands/GetCurrentRoundResult';

export class GetCurrentRoundUseCase {
  constructor(
    private readonly roundRepo: RoundRepository,
    private readonly roundCache: RoundCache,
  ) {}

  async execute(command: GetCurrentRoundCommand): Promise<GetCurrentRoundResult> {
    const cached = await this.roundCache.getCurrentRound(command.operatorId);
    if (cached) {
      return { success: true, round: cached };
    }

    const round = await this.roundRepo.findCurrentByOperatorId(command.operatorId);
    if (!round) {
      return { success: false, error: 'NO_ACTIVE_ROUND' };
    }

    await this.roundCache.setCurrentRound(command.operatorId, round);
    return { success: true, round };
  }
}
