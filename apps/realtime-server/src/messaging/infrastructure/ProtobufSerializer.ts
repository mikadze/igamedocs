import { create, toBinary, fromBinary } from '@bufbuild/protobuf';
import {
  ServerMessageSchema,
  RoundNewSchema,
  RoundBettingSchema,
  RoundStartedSchema,
  RoundCrashedSchema,
  TickSchema,
  BetPlacedSchema,
  BetWonSchema,
  BetLostSchema,
  BetRejectedSchema,
  ReAuthRequiredSchema,
  CreditFailedSchema,
  PongSchema,
  ErrorSchema,
} from '@generated/server_message_pb';
import {
  ClientMessageSchema,
} from '@generated/client_message_pb';
import type { ServerMessage } from '@messaging/domain/ServerMessage';
import type { ClientMessage } from '@messaging/domain/ClientMessage';
import type { MessageSerializer } from '@messaging/application/ports/MessageSerializer';

export class ProtobufSerializer implements MessageSerializer {
  encodeServerMessage(message: ServerMessage): Uint8Array {
    const pbMessage = create(ServerMessageSchema);

    switch (message.type) {
      case 'round_new': {
        const inner = create(RoundNewSchema);
        inner.roundId = message.roundId;
        inner.hashedSeed = message.hashedSeed;
        pbMessage.payload = { case: 'roundNew', value: inner };
        break;
      }
      case 'round_betting': {
        const inner = create(RoundBettingSchema);
        inner.roundId = message.roundId;
        inner.endsAt = BigInt(message.endsAt);
        pbMessage.payload = { case: 'roundBetting', value: inner };
        break;
      }
      case 'round_started': {
        const inner = create(RoundStartedSchema);
        inner.roundId = message.roundId;
        pbMessage.payload = { case: 'roundStarted', value: inner };
        break;
      }
      case 'round_crashed': {
        const inner = create(RoundCrashedSchema);
        inner.roundId = message.roundId;
        inner.crashPoint = message.crashPoint;
        inner.serverSeed = message.serverSeed;
        pbMessage.payload = { case: 'roundCrashed', value: inner };
        break;
      }
      case 'tick': {
        const inner = create(TickSchema);
        inner.roundId = message.roundId;
        inner.multiplier = message.multiplier;
        inner.elapsedMs = message.elapsedMs;
        pbMessage.payload = { case: 'tick', value: inner };
        break;
      }
      case 'bet_placed': {
        const inner = create(BetPlacedSchema);
        inner.betId = message.betId;
        inner.playerId = message.playerId;
        inner.roundId = message.roundId;
        inner.amountCents = message.amountCents;
        pbMessage.payload = { case: 'betPlaced', value: inner };
        break;
      }
      case 'bet_won': {
        const inner = create(BetWonSchema);
        inner.betId = message.betId;
        inner.playerId = message.playerId;
        inner.roundId = message.roundId;
        inner.amountCents = message.amountCents;
        inner.cashoutMultiplier = message.cashoutMultiplier;
        inner.payoutCents = message.payoutCents;
        pbMessage.payload = { case: 'betWon', value: inner };
        break;
      }
      case 'bet_lost': {
        const inner = create(BetLostSchema);
        inner.betId = message.betId;
        inner.playerId = message.playerId;
        inner.roundId = message.roundId;
        inner.amountCents = message.amountCents;
        inner.crashPoint = message.crashPoint;
        pbMessage.payload = { case: 'betLost', value: inner };
        break;
      }
      case 'bet_rejected': {
        const inner = create(BetRejectedSchema);
        inner.playerId = message.playerId;
        inner.roundId = message.roundId;
        inner.amountCents = message.amountCents;
        inner.error = message.error;
        pbMessage.payload = { case: 'betRejected', value: inner };
        break;
      }
      case 'pong': {
        const inner = create(PongSchema);
        pbMessage.payload = { case: 'pong', value: inner };
        break;
      }
      case 'error': {
        const inner = create(ErrorSchema);
        inner.code = message.code;
        inner.message = message.message;
        pbMessage.payload = { case: 'error', value: inner };
        break;
      }
      case 're_auth_required': {
        const inner = create(ReAuthRequiredSchema);
        inner.deadlineMs = BigInt(message.deadlineMs);
        pbMessage.payload = { case: 'reAuthRequired', value: inner };
        break;
      }
      case 'credit_failed': {
        const inner = create(CreditFailedSchema);
        inner.playerId = message.playerId;
        inner.betId = message.betId;
        inner.roundId = message.roundId;
        inner.payoutCents = message.payoutCents;
        inner.reason = message.reason;
        pbMessage.payload = { case: 'creditFailed', value: inner };
        break;
      }
    }

    return toBinary(ServerMessageSchema, pbMessage);
  }

  decodeClientMessage(data: Uint8Array): ClientMessage {
    const raw =
      data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
    const pbMessage = fromBinary(ClientMessageSchema, raw);

    switch (pbMessage.payload.case) {
      case 'placeBet': {
        const bet = pbMessage.payload.value;
        return {
          type: 'place_bet',
          idempotencyKey: bet.idempotencyKey,
          roundId: bet.roundId,
          amountCents: bet.amountCents,
          ...(bet.autoCashout !== undefined
            ? { autoCashout: bet.autoCashout }
            : {}),
        };
      }
      case 'cashout': {
        const cashout = pbMessage.payload.value;
        return {
          type: 'cashout',
          roundId: cashout.roundId,
          betId: cashout.betId,
        };
      }
      case 'ping':
        return { type: 'ping' };
      case undefined:
        throw new Error('ClientMessage has no payload');
      default:
        throw new Error(
          `Unknown client message case: ${(pbMessage.payload as any).case}`,
        );
    }
  }
}
