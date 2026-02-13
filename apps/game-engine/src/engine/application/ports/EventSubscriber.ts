import { PlaceBetCommand } from '@betting/application/commands/PlaceBetCommand';
import { CashoutCommand } from '@betting/application/commands/CashoutCommand';

export interface EventSubscriber {
  onPlaceBet(handler: (cmd: PlaceBetCommand) => void): void;
  onCashout(handler: (cmd: CashoutCommand) => void): void;
}
