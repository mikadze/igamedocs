import { describe, it, expect } from 'vitest';
import type { ClientMessage } from '@messaging/domain/ClientMessage';

describe('ClientMessage', () => {
  it('is exhaustive with 4 variants', () => {
    function getType(msg: ClientMessage): string {
      switch (msg.type) {
        case 'place_bet':
          return 'place_bet';
        case 'cashout':
          return 'cashout';
        case 'ping':
          return 'ping';
        case 're_auth':
          return 're_auth';
        default: {
          const _exhaustive: never = msg;
          return _exhaustive;
        }
      }
    }

    const placeBet: ClientMessage = {
      type: 'place_bet',
      idempotencyKey: 'k1',
      roundId: 'r1',
      amountCents: 1000,
    };
    expect(getType(placeBet)).toBe('place_bet');

    const cashout: ClientMessage = {
      type: 'cashout',
      roundId: 'r1',
      betId: 'b1',
    };
    expect(getType(cashout)).toBe('cashout');

    expect(getType({ type: 'ping' })).toBe('ping');
    expect(getType({ type: 're_auth', token: 'jwt' })).toBe('re_auth');
  });

  it('allows optional autoCashout on place_bet', () => {
    const withAuto: ClientMessage = {
      type: 'place_bet',
      idempotencyKey: 'k1',
      roundId: 'r1',
      amountCents: 1000,
      autoCashout: 2.5,
    };
    expect(withAuto.autoCashout).toBe(2.5);

    const withoutAuto: ClientMessage = {
      type: 'place_bet',
      idempotencyKey: 'k1',
      roundId: 'r1',
      amountCents: 1000,
    };
    expect(withoutAuto.autoCashout).toBeUndefined();
  });
});
