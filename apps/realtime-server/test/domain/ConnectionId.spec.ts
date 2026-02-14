import { describe, it, expect } from 'vitest';
import { ConnectionId } from '@connection/domain/ConnectionId';

describe('ConnectionId', () => {
  it('generates unique ids', () => {
    const a = ConnectionId.generate();
    const b = ConnectionId.generate();
    expect(a.value).not.toBe(b.value);
  });

  it('preserves value through from()', () => {
    const id = ConnectionId.from('abc-123');
    expect(id.value).toBe('abc-123');
  });

  it('equals another ConnectionId with same value', () => {
    const a = ConnectionId.from('same');
    const b = ConnectionId.from('same');
    expect(a.equals(b)).toBe(true);
  });

  it('does not equal a ConnectionId with different value', () => {
    const a = ConnectionId.from('one');
    const b = ConnectionId.from('two');
    expect(a.equals(b)).toBe(false);
  });

  it('throws on empty string', () => {
    expect(() => ConnectionId.from('')).toThrow('ConnectionId cannot be empty');
  });

  it('throws on whitespace-only string', () => {
    expect(() => ConnectionId.from('   ')).toThrow(
      'ConnectionId cannot be empty',
    );
  });

  it('toString returns the value', () => {
    const id = ConnectionId.from('test-id');
    expect(id.toString()).toBe('test-id');
  });
});
