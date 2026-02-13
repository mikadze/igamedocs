import { randomUUID } from 'crypto';
import { GameConfig } from '@engine/domain/GameConfig';
import { Money } from '@shared/kernel/Money';
import { Bet } from '@betting/domain/Bet';
import { BetStore } from '@betting/application/ports/BetStore';
import { WalletGateway } from '@betting/application/ports/WalletGateway';
import { PlaceBetCommand } from '@betting/application/commands/PlaceBetCommand';
import { PlaceBetResult } from '@betting/application/commands/PlaceBetResult';

export class PlaceBetUseCase {
  constructor(
    private readonly config: GameConfig,
    private readonly betStore: BetStore,
    private readonly walletGateway: WalletGateway,
  ) { }

  async execute(command: PlaceBetCommand): Promise<PlaceBetResult> {
    if (command.amountCents < this.config.minBetCents) {
      return { success: false, error: 'BELOW_MIN_BET' };
    }
    if (command.amountCents > this.config.maxBetCents) {
      return { success: false, error: 'ABOVE_MAX_BET' };
    }

    const amount = Money.fromCents(command.amountCents);
    const betId = randomUUID();

    const walletResult = await this.walletGateway.debit(
      command.playerId,
      amount,
      command.roundId,
      betId,
    );

    if (!walletResult.success) {
      const errorMap = {
        INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
        PLAYER_BLOCKED: 'PLAYER_BLOCKED',
        TIMEOUT: 'WALLET_TIMEOUT',
      } as const;
      return { success: false, error: errorMap[walletResult.error] };
    }

    const bet = new Bet(
      betId,
      command.playerId,
      command.roundId,
      amount,
      command.autoCashout,
    );
    this.betStore.add(bet);

    return { success: true, betId: bet.id };
  }
}
