import { RoundStatus } from '../../domain/RoundRecord';

export interface UpdateRoundStatusCommand {
  roundId: string;
  status: RoundStatus;
  crashPoint?: string;
}
