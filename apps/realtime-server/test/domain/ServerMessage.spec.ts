import { describe, it, expect } from 'vitest';
import type { ServerMessage } from '@messaging/domain/ServerMessage';

describe('ServerMessage', () => {
  it('is exhaustive with 13 variants', () => {
    function getType(msg: ServerMessage): string {
      switch (msg.type) {
        case 'round_new':
          return msg.type;
        case 'round_betting':
          return msg.type;
        case 'round_started':
          return msg.type;
        case 'round_crashed':
          return msg.type;
        case 'tick':
          return msg.type;
        case 'bet_placed':
          return msg.type;
        case 'bet_won':
          return msg.type;
        case 'bet_lost':
          return msg.type;
        case 'bet_rejected':
          return msg.type;
        case 'pong':
          return msg.type;
        case 'error':
          return msg.type;
        case 're_auth_required':
          return msg.type;
        case 'credit_failed':
          return msg.type;
        default: {
          const _exhaustive: never = msg;
          return _exhaustive;
        }
      }
    }

    const tick: ServerMessage = {
      type: 'tick',
      roundId: 'r1',
      multiplier: 1.5,
      elapsedMs: 500,
    };
    expect(getType(tick)).toBe('tick');
  });

  it('round variants have correct shape', () => {
    const roundNew: ServerMessage = {
      type: 'round_new',
      roundId: 'r1',
      hashedSeed: 'abc',
    };
    expect(roundNew.roundId).toBe('r1');

    const roundCrashed: ServerMessage = {
      type: 'round_crashed',
      roundId: 'r1',
      crashPoint: 2.5,
      serverSeed: 'seed',
    };
    expect(roundCrashed.crashPoint).toBe(2.5);
  });

  it('bet variants have correct shape', () => {
    const betWon: ServerMessage = {
      type: 'bet_won',
      betId: 'b1',
      playerId: 'p1',
      roundId: 'r1',
      amountCents: 1000,
      cashoutMultiplier: 2.0,
      payoutCents: 2000,
    };
    expect(betWon.payoutCents).toBe(2000);
  });

  it('credit_failed has correct shape', () => {
    const msg: ServerMessage = {
      type: 'credit_failed',
      playerId: 'p1',
      betId: 'b1',
      roundId: 'r1',
      payoutCents: 5000,
      reason: 'TIMEOUT',
    };
    expect(msg.reason).toBe('TIMEOUT');
  });

  it('re_auth_required has correct shape', () => {
    const msg: ServerMessage = {
      type: 're_auth_required',
      deadlineMs: 1700000000000,
    };
    expect(msg.deadlineMs).toBe(1700000000000);
  });
});
