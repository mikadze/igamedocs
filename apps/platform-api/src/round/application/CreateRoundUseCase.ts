import { randomUUID } from 'crypto';
import { RoundRecord } from '../domain/RoundRecord';
import { RoundRepository } from './ports/RoundRepository';
import { RoundCache } from './ports/RoundCache';
import { CreateRoundCommand } from './commands/CreateRoundCommand';
import { CreateRoundResult } from './commands/CreateRoundResult';

const DEFAULT_BETTING_WINDOW_MS = 10000;

export class CreateRoundUseCase {
  constructor(
    private readonly roundRepo: RoundRepository,
    private readonly roundCache: RoundCache,
  ) {}

  async execute(command: CreateRoundCommand): Promise<CreateRoundResult> {
    const round = RoundRecord.create(
      randomUUID(),
      command.operatorId,
      command.bettingWindowMs ?? DEFAULT_BETTING_WINDOW_MS,
    );

    const saved = await this.roundRepo.save(round);
    await this.roundCache.setCurrentRound(command.operatorId, saved);

    return { success: true, round: saved };
  }
}
