import { describe, it, expect } from 'vitest';
import { ConnectionState, canTransition } from '@connection/domain/ConnectionState';

describe('ConnectionState', () => {
  it('has exactly 3 states', () => {
    const values = Object.values(ConnectionState);
    expect(values).toHaveLength(3);
    expect(values).toContain('AUTHENTICATED');
    expect(values).toContain('JOINED');
    expect(values).toContain('DISCONNECTED');
  });

  describe('canTransition', () => {
    it('allows AUTHENTICATED → JOINED', () => {
      expect(
        canTransition(ConnectionState.AUTHENTICATED, ConnectionState.JOINED),
      ).toBe(true);
    });

    it('allows AUTHENTICATED → DISCONNECTED', () => {
      expect(
        canTransition(
          ConnectionState.AUTHENTICATED,
          ConnectionState.DISCONNECTED,
        ),
      ).toBe(true);
    });

    it('allows JOINED → DISCONNECTED', () => {
      expect(
        canTransition(ConnectionState.JOINED, ConnectionState.DISCONNECTED),
      ).toBe(true);
    });

    it('rejects JOINED → AUTHENTICATED', () => {
      expect(
        canTransition(ConnectionState.JOINED, ConnectionState.AUTHENTICATED),
      ).toBe(false);
    });

    it('rejects DISCONNECTED → any', () => {
      expect(
        canTransition(
          ConnectionState.DISCONNECTED,
          ConnectionState.AUTHENTICATED,
        ),
      ).toBe(false);
      expect(
        canTransition(ConnectionState.DISCONNECTED, ConnectionState.JOINED),
      ).toBe(false);
      expect(
        canTransition(
          ConnectionState.DISCONNECTED,
          ConnectionState.DISCONNECTED,
        ),
      ).toBe(false);
    });

    it('rejects self-transition AUTHENTICATED → AUTHENTICATED', () => {
      expect(
        canTransition(
          ConnectionState.AUTHENTICATED,
          ConnectionState.AUTHENTICATED,
        ),
      ).toBe(false);
    });
  });
});
