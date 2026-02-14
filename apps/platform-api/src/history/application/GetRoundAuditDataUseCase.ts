import { RoundQueryRepository } from './ports/RoundQueryRepository';
import { GetRoundAuditDataCommand } from './commands/GetRoundAuditDataCommand';
import { GetRoundAuditDataResult } from './commands/GetRoundAuditDataResult';

export class GetRoundAuditDataUseCase {
  constructor(
    private readonly roundQueryRepo: RoundQueryRepository,
  ) {}

  async execute(command: GetRoundAuditDataCommand): Promise<GetRoundAuditDataResult> {
    const data = await this.roundQueryRepo.findAuditData(command.roundId);
    if (!data) {
      return { success: false, error: 'ROUND_NOT_FOUND' };
    }
    return { success: true, data };
  }
}
