import {
  DomainError,
  InvalidMoneyError,
  InvalidStateTransition,
  BetNotActiveError,
  InvalidCrashPointError,
  InvalidSeedError,
} from '@shared/kernel/DomainError';

describe('DomainError', () => {
  it('extends Error', () => {
    const err = new DomainError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
  });

  it('sets name to class name', () => {
    expect(new DomainError('msg').name).toBe('DomainError');
    expect(new InvalidMoneyError('msg').name).toBe('InvalidMoneyError');
    expect(new InvalidStateTransition('msg').name).toBe('InvalidStateTransition');
    expect(new BetNotActiveError('msg').name).toBe('BetNotActiveError');
    expect(new InvalidCrashPointError('msg').name).toBe('InvalidCrashPointError');
    expect(new InvalidSeedError('msg').name).toBe('InvalidSeedError');
  });

  it('subclasses are instances of DomainError', () => {
    expect(new InvalidMoneyError('msg')).toBeInstanceOf(DomainError);
    expect(new InvalidStateTransition('msg')).toBeInstanceOf(DomainError);
    expect(new BetNotActiveError('msg')).toBeInstanceOf(DomainError);
  });
});
