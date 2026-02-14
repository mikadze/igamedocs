import { BetQueryRepository } from './ports/BetQueryRepository';
import { GetPlayerBetHistoryCommand } from './commands/GetPlayerBetHistoryCommand';
import { GetPlayerBetHistoryResult } from './commands/GetPlayerBetHistoryResult';

const DEFAULT_PAGE_SIZE = 20;

export class GetPlayerBetHistoryUseCase {
  constructor(
    private readonly betQueryRepo: BetQueryRepository,
  ) {}

  async execute(command: GetPlayerBetHistoryCommand): Promise<GetPlayerBetHistoryResult> {
    return this.betQueryRepo.findByPlayerPaginated(
      command.operatorPlayerId,
      command.cursor,
      command.limit ?? DEFAULT_PAGE_SIZE,
    );
  }
}
