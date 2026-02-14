import { describe, it, expect } from 'vitest';
import { DomainError, InvalidStateTransition } from '@shared/kernel/DomainError';

describe('DomainError', () => {
  it('extends Error', () => {
    const err = new DomainError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
  });

  it('sets name to class name', () => {
    expect(new DomainError('msg').name).toBe('DomainError');
    expect(new InvalidStateTransition('msg').name).toBe('InvalidStateTransition');
  });

  it('preserves message', () => {
    const err = new DomainError('something went wrong');
    expect(err.message).toBe('something went wrong');
  });

  it('InvalidStateTransition is instanceof DomainError', () => {
    expect(new InvalidStateTransition('msg')).toBeInstanceOf(DomainError);
  });
});
