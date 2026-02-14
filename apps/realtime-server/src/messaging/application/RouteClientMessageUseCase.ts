import type { ConnectionId } from '@connection/domain/ConnectionId';
import type { ClientMessage } from '@messaging/domain/ClientMessage';
import type { PlayerConnectionLookup } from '@shared/ports/PlayerConnectionLookup';
import type { ForwardBetInput, ForwardBetResult } from '@messaging/application/ForwardBetCommandUseCase';
import type { ForwardCashoutInput, ForwardCashoutResult } from '@messaging/application/ForwardCashoutCommandUseCase';
import type { Logger } from '@shared/ports/Logger';

export interface ForwardBetCommand {
  execute(input: ForwardBetInput): ForwardBetResult;
}

export interface ForwardCashoutCommand {
  execute(input: ForwardCashoutInput): ForwardCashoutResult;
}

export interface RouteInput {
  readonly connectionId: ConnectionId;
  readonly message: ClientMessage;
}

export type RouteResult =
  | { readonly success: true }
  | { readonly success: false; readonly error: string };

export class RouteClientMessageUseCase {
  constructor(
    private readonly connectionStore: PlayerConnectionLookup,
    private readonly forwardBet: ForwardBetCommand,
    private readonly forwardCashout: ForwardCashoutCommand,
    private readonly logger: Logger,
  ) {}

  execute(input: RouteInput): RouteResult {
    const connection = this.connectionStore.getById(input.connectionId);
    if (!connection) {
      return { success: false, error: 'CONNECTION_NOT_FOUND' };
    }

    const { message } = input;

    switch (message.type) {
      case 'place_bet':
        return this.forwardBet.execute({
          playerId: connection.playerId,
          idempotencyKey: message.idempotencyKey,
          roundId: message.roundId,
          amountCents: message.amountCents,
          autoCashout: message.autoCashout,
        });

      case 'cashout':
        return this.forwardCashout.execute({
          playerId: connection.playerId,
          roundId: message.roundId,
          betId: message.betId,
        });

      case 're_auth':
        return { success: false, error: 'RE_AUTH_NOT_IMPLEMENTED' };

      case 'ping':
        return { success: false, error: 'PING_HANDLED_AT_TRANSPORT' };
    }
  }
}
