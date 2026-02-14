import { describe, it, expect } from 'bun:test';
import { create, toBinary, fromBinary } from '@bufbuild/protobuf';
import { ProtobufSerializer } from '@messaging/infrastructure/ProtobufSerializer';
import {
  ClientMessageSchema,
  PlaceBetSchema,
  CashoutSchema,
  PingSchema,
} from '@generated/client_message_pb';
import { ServerMessageSchema } from '@generated/server_message_pb';
import type { ServerMessage } from '@messaging/domain/ServerMessage';
import type { ClientMessage } from '@messaging/domain/ClientMessage';

/**
 * RT-5.4 — Protobuf Round-Trip Integration Test
 *
 * Verifies every ClientMessage and ServerMessage variant encodes and
 * decodes correctly, and that binary protobuf is smaller than JSON.
 */
describe('RT-5.4: Protobuf Round-Trip', () => {
  const serializer = new ProtobufSerializer();

  // ──── ClientMessage Variants ────────────────────────────────

  describe('ClientMessage round-trip', () => {
    function clientRoundTrip(build: () => { case: string; value: any }): ClientMessage {
      const msg = create(ClientMessageSchema);
      msg.payload = build() as any;
      const binary = toBinary(ClientMessageSchema, msg);
      return serializer.decodeClientMessage(binary);
    }

    it('place_bet with autoCashout', () => {
      const result = clientRoundTrip(() => {
        const bet = create(PlaceBetSchema);
        bet.idempotencyKey = 'key-rt1';
        bet.roundId = 'round-rt1';
        bet.amountCents = 500;
        bet.autoCashout = 2.5;
        return { case: 'placeBet', value: bet };
      });

      expect(result).toEqual({
        type: 'place_bet',
        idempotencyKey: 'key-rt1',
        roundId: 'round-rt1',
        amountCents: 500,
        autoCashout: 2.5,
      });
    });

    it('place_bet without autoCashout', () => {
      const result = clientRoundTrip(() => {
        const bet = create(PlaceBetSchema);
        bet.idempotencyKey = 'key-rt2';
        bet.roundId = 'round-rt2';
        bet.amountCents = 100;
        return { case: 'placeBet', value: bet };
      });

      expect(result.type).toBe('place_bet');
      if (result.type === 'place_bet') {
        expect(result.autoCashout).toBeUndefined();
      }
    });

    it('cashout', () => {
      const result = clientRoundTrip(() => {
        const cashout = create(CashoutSchema);
        cashout.roundId = 'round-rt3';
        cashout.betId = 'bet-rt3';
        return { case: 'cashout', value: cashout };
      });

      expect(result).toEqual({
        type: 'cashout',
        roundId: 'round-rt3',
        betId: 'bet-rt3',
      });
    });

    it('ping', () => {
      const result = clientRoundTrip(() => {
        return { case: 'ping', value: create(PingSchema) };
      });

      expect(result).toEqual({ type: 'ping' });
    });
  });

  // ──── ServerMessage Variants ────────────────────────────────

  describe('ServerMessage round-trip', () => {
    function serverRoundTrip(msg: ServerMessage) {
      const binary = serializer.encodeServerMessage(msg);
      return fromBinary(ServerMessageSchema, binary);
    }

    it('round_new', () => {
      const pb = serverRoundTrip({ type: 'round_new', roundId: 'r1', hashedSeed: 'hash-abc' });
      expect(pb.payload.case).toBe('roundNew');
      if (pb.payload.case === 'roundNew') {
        expect(pb.payload.value.roundId).toBe('r1');
        expect(pb.payload.value.hashedSeed).toBe('hash-abc');
      }
    });

    it('round_betting', () => {
      const pb = serverRoundTrip({ type: 'round_betting', roundId: 'r1', endsAt: 1700000000000 });
      expect(pb.payload.case).toBe('roundBetting');
      if (pb.payload.case === 'roundBetting') {
        expect(pb.payload.value.roundId).toBe('r1');
        expect(pb.payload.value.endsAt).toBe(BigInt(1700000000000));
      }
    });

    it('round_started', () => {
      const pb = serverRoundTrip({ type: 'round_started', roundId: 'r1' });
      expect(pb.payload.case).toBe('roundStarted');
      if (pb.payload.case === 'roundStarted') {
        expect(pb.payload.value.roundId).toBe('r1');
      }
    });

    it('round_crashed', () => {
      const pb = serverRoundTrip({ type: 'round_crashed', roundId: 'r1', crashPoint: 2.5, serverSeed: 'seed-xyz' });
      expect(pb.payload.case).toBe('roundCrashed');
      if (pb.payload.case === 'roundCrashed') {
        expect(pb.payload.value.crashPoint).toBe(2.5);
        expect(pb.payload.value.serverSeed).toBe('seed-xyz');
      }
    });

    it('tick', () => {
      const pb = serverRoundTrip({ type: 'tick', roundId: 'r1', multiplier: 1.5, elapsedMs: 500 });
      expect(pb.payload.case).toBe('tick');
      if (pb.payload.case === 'tick') {
        expect(pb.payload.value.multiplier).toBe(1.5);
        expect(pb.payload.value.elapsedMs).toBe(500);
      }
    });

    it('bet_placed', () => {
      const pb = serverRoundTrip({ type: 'bet_placed', betId: 'b1', playerId: 'p1', roundId: 'r1', amountCents: 100 });
      expect(pb.payload.case).toBe('betPlaced');
      if (pb.payload.case === 'betPlaced') {
        expect(pb.payload.value.betId).toBe('b1');
        expect(pb.payload.value.playerId).toBe('p1');
        expect(pb.payload.value.amountCents).toBe(100);
      }
    });

    it('bet_won', () => {
      const pb = serverRoundTrip({ type: 'bet_won', betId: 'b1', playerId: 'p1', roundId: 'r1', amountCents: 100, cashoutMultiplier: 2.0, payoutCents: 200 });
      expect(pb.payload.case).toBe('betWon');
      if (pb.payload.case === 'betWon') {
        expect(pb.payload.value.cashoutMultiplier).toBe(2.0);
        expect(pb.payload.value.payoutCents).toBe(200);
      }
    });

    it('bet_lost', () => {
      const pb = serverRoundTrip({ type: 'bet_lost', betId: 'b1', playerId: 'p1', roundId: 'r1', amountCents: 100, crashPoint: 1.5 });
      expect(pb.payload.case).toBe('betLost');
      if (pb.payload.case === 'betLost') {
        expect(pb.payload.value.crashPoint).toBe(1.5);
      }
    });

    it('bet_rejected', () => {
      const pb = serverRoundTrip({ type: 'bet_rejected', playerId: 'p1', roundId: 'r1', amountCents: 100, error: 'ROUND_NOT_BETTING' });
      expect(pb.payload.case).toBe('betRejected');
      if (pb.payload.case === 'betRejected') {
        expect(pb.payload.value.error).toBe('ROUND_NOT_BETTING');
      }
    });

    it('pong', () => {
      const pb = serverRoundTrip({ type: 'pong' });
      expect(pb.payload.case).toBe('pong');
    });

    it('error', () => {
      const pb = serverRoundTrip({ type: 'error', code: 'INVALID_MESSAGE', message: 'Bad format' });
      expect(pb.payload.case).toBe('error');
      if (pb.payload.case === 'error') {
        expect(pb.payload.value.code).toBe('INVALID_MESSAGE');
        expect(pb.payload.value.message).toBe('Bad format');
      }
    });

    it('re_auth_required', () => {
      const pb = serverRoundTrip({ type: 're_auth_required', deadlineMs: 30000 });
      expect(pb.payload.case).toBe('reAuthRequired');
      if (pb.payload.case === 'reAuthRequired') {
        expect(pb.payload.value.deadlineMs).toBe(BigInt(30000));
      }
    });

    it('credit_failed', () => {
      const pb = serverRoundTrip({ type: 'credit_failed', playerId: 'p1', betId: 'b1', roundId: 'r1', payoutCents: 5000, reason: 'TIMEOUT' });
      expect(pb.payload.case).toBe('creditFailed');
      if (pb.payload.case === 'creditFailed') {
        expect(pb.payload.value.playerId).toBe('p1');
        expect(pb.payload.value.reason).toBe('TIMEOUT');
      }
    });
  });

  // ──── Binary Size vs JSON ───────────────────────────────────

  describe('binary size < JSON equivalent', () => {
    const encoder = new TextEncoder();

    it('tick is smaller in protobuf than JSON', () => {
      const msg: ServerMessage = { type: 'tick', roundId: 'round-abc-123', multiplier: 1.5, elapsedMs: 500 };
      const binary = serializer.encodeServerMessage(msg);
      const json = encoder.encode(JSON.stringify(msg));
      expect(binary.length).toBeLessThan(json.length);
    });

    it('bet_placed is smaller in protobuf than JSON', () => {
      const msg: ServerMessage = { type: 'bet_placed', betId: 'bet-abc-123', playerId: 'player-xyz', roundId: 'round-abc-123', amountCents: 5000 };
      const binary = serializer.encodeServerMessage(msg);
      const json = encoder.encode(JSON.stringify(msg));
      expect(binary.length).toBeLessThan(json.length);
    });

    it('round_crashed is smaller in protobuf than JSON', () => {
      const msg: ServerMessage = { type: 'round_crashed', roundId: 'round-abc-123', crashPoint: 2.5, serverSeed: 'abcdef1234567890' };
      const binary = serializer.encodeServerMessage(msg);
      const json = encoder.encode(JSON.stringify(msg));
      expect(binary.length).toBeLessThan(json.length);
    });

    it('place_bet client message is smaller in protobuf than JSON', () => {
      const domainMsg: ClientMessage = { type: 'place_bet', idempotencyKey: 'key-abc-123', roundId: 'round-abc-123', amountCents: 5000, autoCashout: 3.0 };
      const bet = create(PlaceBetSchema);
      bet.idempotencyKey = domainMsg.idempotencyKey;
      bet.roundId = domainMsg.roundId;
      bet.amountCents = domainMsg.amountCents;
      bet.autoCashout = domainMsg.autoCashout;
      const msg = create(ClientMessageSchema);
      msg.payload = { case: 'placeBet', value: bet };
      const binary = toBinary(ClientMessageSchema, msg);
      const json = encoder.encode(JSON.stringify(domainMsg));
      expect(binary.length).toBeLessThan(json.length);
    });
  });
});
