import { describe, it, expect } from 'vitest';
import { create, toBinary } from '@bufbuild/protobuf';
import { ProtobufSerializer } from '@messaging/infrastructure/ProtobufSerializer';
import {
  ClientMessageSchema,
  PlaceBetSchema,
  CashoutSchema,
  PingSchema,
} from '@generated/client_message_pb';
import {
  ServerMessageSchema,
} from '@generated/server_message_pb';
import { fromBinary } from '@bufbuild/protobuf';
import type { ServerMessage } from '@messaging/domain/ServerMessage';
import type { ClientMessage } from '@messaging/domain/ClientMessage';

describe('ProtobufSerializer', () => {
  const serializer = new ProtobufSerializer();

  describe('decodeClientMessage', () => {
    it('decodes place_bet', () => {
      const bet = create(PlaceBetSchema);
      bet.idempotencyKey = 'key-1';
      bet.roundId = 'round-1';
      bet.amountCents = 500;
      bet.autoCashout = 2.5;

      const msg = create(ClientMessageSchema);
      msg.payload = { case: 'placeBet', value: bet };

      const binary = toBinary(ClientMessageSchema, msg);
      const result = serializer.decodeClientMessage(binary);

      expect(result).toEqual({
        type: 'place_bet',
        idempotencyKey: 'key-1',
        roundId: 'round-1',
        amountCents: 500,
        autoCashout: 2.5,
      });
    });

    it('decodes place_bet without optional autoCashout', () => {
      const bet = create(PlaceBetSchema);
      bet.idempotencyKey = 'key-2';
      bet.roundId = 'round-2';
      bet.amountCents = 100;

      const msg = create(ClientMessageSchema);
      msg.payload = { case: 'placeBet', value: bet };

      const binary = toBinary(ClientMessageSchema, msg);
      const result = serializer.decodeClientMessage(binary);

      expect(result.type).toBe('place_bet');
      if (result.type === 'place_bet') {
        expect(result.autoCashout).toBeUndefined();
      }
    });

    it('decodes cashout', () => {
      const cashout = create(CashoutSchema);
      cashout.roundId = 'round-1';
      cashout.betId = 'bet-1';

      const msg = create(ClientMessageSchema);
      msg.payload = { case: 'cashout', value: cashout };

      const binary = toBinary(ClientMessageSchema, msg);
      const result = serializer.decodeClientMessage(binary);

      expect(result).toEqual({
        type: 'cashout',
        roundId: 'round-1',
        betId: 'bet-1',
      });
    });

    it('decodes ping', () => {
      const ping = create(PingSchema);
      const msg = create(ClientMessageSchema);
      msg.payload = { case: 'ping', value: ping };

      const binary = toBinary(ClientMessageSchema, msg);
      const result = serializer.decodeClientMessage(binary);

      expect(result).toEqual({ type: 'ping' });
    });

    it('throws on empty payload', () => {
      const msg = create(ClientMessageSchema);
      const binary = toBinary(ClientMessageSchema, msg);

      expect(() => serializer.decodeClientMessage(binary)).toThrow(
        'ClientMessage has no payload',
      );
    });

    it('throws on invalid binary data', () => {
      const garbage = new Uint8Array([0xff, 0xfe, 0xfd]);
      expect(() => serializer.decodeClientMessage(garbage)).toThrow();
    });
  });

  describe('encodeServerMessage', () => {
    function roundTrip(msg: ServerMessage) {
      const binary = serializer.encodeServerMessage(msg);
      return fromBinary(ServerMessageSchema, binary);
    }

    it('encodes round_new', () => {
      const pb = roundTrip({
        type: 'round_new',
        roundId: 'r1',
        hashedSeed: 'hash123',
      });
      expect(pb.payload.case).toBe('roundNew');
      if (pb.payload.case === 'roundNew') {
        expect(pb.payload.value.roundId).toBe('r1');
        expect(pb.payload.value.hashedSeed).toBe('hash123');
      }
    });

    it('encodes round_betting', () => {
      const pb = roundTrip({
        type: 'round_betting',
        roundId: 'r1',
        endsAt: 1700000000000,
      });
      expect(pb.payload.case).toBe('roundBetting');
      if (pb.payload.case === 'roundBetting') {
        expect(pb.payload.value.roundId).toBe('r1');
        expect(pb.payload.value.endsAt).toBe(BigInt(1700000000000));
      }
    });

    it('encodes round_started', () => {
      const pb = roundTrip({ type: 'round_started', roundId: 'r1' });
      expect(pb.payload.case).toBe('roundStarted');
      if (pb.payload.case === 'roundStarted') {
        expect(pb.payload.value.roundId).toBe('r1');
      }
    });

    it('encodes round_crashed', () => {
      const pb = roundTrip({
        type: 'round_crashed',
        roundId: 'r1',
        crashPoint: 2.5,
        serverSeed: 'seed123',
      });
      expect(pb.payload.case).toBe('roundCrashed');
      if (pb.payload.case === 'roundCrashed') {
        expect(pb.payload.value.crashPoint).toBe(2.5);
        expect(pb.payload.value.serverSeed).toBe('seed123');
      }
    });

    it('encodes tick', () => {
      const pb = roundTrip({
        type: 'tick',
        roundId: 'r1',
        multiplier: 1.5,
        elapsedMs: 500,
      });
      expect(pb.payload.case).toBe('tick');
      if (pb.payload.case === 'tick') {
        expect(pb.payload.value.multiplier).toBe(1.5);
        expect(pb.payload.value.elapsedMs).toBe(500);
      }
    });

    it('encodes bet_placed', () => {
      const pb = roundTrip({
        type: 'bet_placed',
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 100,
      });
      expect(pb.payload.case).toBe('betPlaced');
      if (pb.payload.case === 'betPlaced') {
        expect(pb.payload.value.betId).toBe('b1');
        expect(pb.payload.value.amountCents).toBe(100);
      }
    });

    it('encodes bet_won', () => {
      const pb = roundTrip({
        type: 'bet_won',
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 100,
        cashoutMultiplier: 2.0,
        payoutCents: 200,
      });
      expect(pb.payload.case).toBe('betWon');
      if (pb.payload.case === 'betWon') {
        expect(pb.payload.value.cashoutMultiplier).toBe(2.0);
        expect(pb.payload.value.payoutCents).toBe(200);
      }
    });

    it('encodes bet_lost', () => {
      const pb = roundTrip({
        type: 'bet_lost',
        betId: 'b1',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 100,
        crashPoint: 1.5,
      });
      expect(pb.payload.case).toBe('betLost');
      if (pb.payload.case === 'betLost') {
        expect(pb.payload.value.crashPoint).toBe(1.5);
      }
    });

    it('encodes bet_rejected', () => {
      const pb = roundTrip({
        type: 'bet_rejected',
        playerId: 'p1',
        roundId: 'r1',
        amountCents: 100,
        error: 'ROUND_NOT_BETTING',
      });
      expect(pb.payload.case).toBe('betRejected');
      if (pb.payload.case === 'betRejected') {
        expect(pb.payload.value.error).toBe('ROUND_NOT_BETTING');
      }
    });

    it('encodes pong', () => {
      const pb = roundTrip({ type: 'pong' });
      expect(pb.payload.case).toBe('pong');
    });

    it('encodes error', () => {
      const pb = roundTrip({
        type: 'error',
        code: 'INVALID_MESSAGE',
        message: 'Bad format',
      });
      expect(pb.payload.case).toBe('error');
      if (pb.payload.case === 'error') {
        expect(pb.payload.value.code).toBe('INVALID_MESSAGE');
        expect(pb.payload.value.message).toBe('Bad format');
      }
    });

    it('encodes re_auth_required', () => {
      const pb = roundTrip({
        type: 're_auth_required',
        deadlineMs: 30000,
      });
      expect(pb.payload.case).toBe('reAuthRequired');
      if (pb.payload.case === 'reAuthRequired') {
        expect(pb.payload.value.deadlineMs).toBe(BigInt(30000));
      }
    });

    it('encodes credit_failed', () => {
      const pb = roundTrip({
        type: 'credit_failed',
        playerId: 'p1',
        betId: 'b1',
        roundId: 'r1',
        payoutCents: 5000,
        reason: 'TIMEOUT',
      });
      expect(pb.payload.case).toBe('creditFailed');
      if (pb.payload.case === 'creditFailed') {
        expect(pb.payload.value.playerId).toBe('p1');
        expect(pb.payload.value.betId).toBe('b1');
        expect(pb.payload.value.payoutCents).toBe(5000);
        expect(pb.payload.value.reason).toBe('TIMEOUT');
      }
    });

    it('produces valid binary output', () => {
      const binary = serializer.encodeServerMessage({
        type: 'pong',
      });
      expect(binary).toBeInstanceOf(Uint8Array);
      expect(binary.length).toBeGreaterThan(0);
    });
  });

  describe('round-trip: encode then decode', () => {
    it('place_bet survives encode-decode round-trip', () => {
      const original: ClientMessage = {
        type: 'place_bet',
        idempotencyKey: 'key-1',
        roundId: 'r1',
        amountCents: 500,
        autoCashout: 3.0,
      };

      const bet = create(PlaceBetSchema);
      bet.idempotencyKey = original.idempotencyKey;
      bet.roundId = original.roundId;
      bet.amountCents = original.amountCents;
      bet.autoCashout = original.autoCashout;

      const msg = create(ClientMessageSchema);
      msg.payload = { case: 'placeBet', value: bet };

      const binary = toBinary(ClientMessageSchema, msg);
      const decoded = serializer.decodeClientMessage(binary);

      expect(decoded).toEqual(original);
    });
  });
});
