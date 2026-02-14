import { BetSettlementStore } from './ports/BetSettlementStore';
import { SettleLosingBetsCommand } from './commands/SettleLosingBetsCommand';
import { SettleLosingBetsResult } from './commands/SettleLosingBetsResult';

export class SettleLosingBetsUseCase {
  constructor(
    private readonly betSettlementStore: BetSettlementStore,
  ) {}

  async execute(command: SettleLosingBetsCommand): Promise<SettleLosingBetsResult> {
    try {
      const count = await this.betSettlementStore.settleLosingBets(command.roundId);
      return { success: true, settledCount: count };
    } catch {
      return { success: false, error: 'SETTLE_FAILED' };
    }
  }
}
