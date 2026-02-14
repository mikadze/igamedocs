import { RoundQueryRepository } from './ports/RoundQueryRepository';
import { HistoryCache } from './ports/HistoryCache';
import { GetRoundHistoryCommand } from './commands/GetRoundHistoryCommand';
import { GetRoundHistoryResult } from './commands/GetRoundHistoryResult';

const DEFAULT_PAGE_SIZE = 20;
const CACHE_TTL = 60;

export class GetRoundHistoryUseCase {
  constructor(
    private readonly roundQueryRepo: RoundQueryRepository,
    private readonly historyCache: HistoryCache,
  ) {}

  async execute(command: GetRoundHistoryCommand): Promise<GetRoundHistoryResult> {
    const limit = command.limit ?? DEFAULT_PAGE_SIZE;

    if (!command.cursor) {
      const cached = await this.historyCache.getRoundHistoryPage1(command.operatorId);
      if (cached) return cached;
    }

    const result = await this.roundQueryRepo.findPaginated(
      command.operatorId, command.cursor, limit,
    );

    if (!command.cursor) {
      await this.historyCache.setRoundHistoryPage1(command.operatorId, result, CACHE_TTL);
    }

    return result;
  }
}
