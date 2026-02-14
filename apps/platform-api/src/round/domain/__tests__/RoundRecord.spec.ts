import { RoundRecord, RoundStatus } from '../RoundRecord';
import { InvalidCrashPointError, InvalidStateTransition } from '@shared/kernel/DomainError';

describe('RoundRecord', () => {
  describe('create', () => {
    it('starts in WAITING status', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      expect(round.status).toBe('WAITING');
    });

    it('has null timestamps on creation', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      expect(round.startedAt).toBeNull();
      expect(round.crashedAt).toBeNull();
      expect(round.settledAt).toBeNull();
      expect(round.crashPoint).toBeNull();
    });

    it('sets createdAt', () => {
      const before = new Date();
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      expect(round.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('stores id, operatorId, and bettingWindowMs', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      expect(round.id).toBe('r-1');
      expect(round.operatorId).toBe('op-1');
      expect(round.bettingWindowMs).toBe(10000);
    });
  });

  describe('transitionTo', () => {
    it('WAITING -> BETTING succeeds', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      round.transitionTo('BETTING');
      expect(round.status).toBe('BETTING');
    });

    it('BETTING -> FLYING succeeds and sets startedAt', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      round.transitionTo('BETTING');
      round.transitionTo('FLYING');
      expect(round.status).toBe('FLYING');
      expect(round.startedAt).toBeInstanceOf(Date);
    });

    it('FLYING -> CRASHED succeeds and sets crashedAt', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      round.transitionTo('BETTING');
      round.transitionTo('FLYING');
      round.transitionTo('CRASHED');
      expect(round.status).toBe('CRASHED');
      expect(round.crashedAt).toBeInstanceOf(Date);
    });

    it('CRASHED -> SETTLED succeeds and sets settledAt', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      round.transitionTo('BETTING');
      round.transitionTo('FLYING');
      round.transitionTo('CRASHED');
      round.transitionTo('SETTLED');
      expect(round.status).toBe('SETTLED');
      expect(round.settledAt).toBeInstanceOf(Date);
    });

    it('rejects skip transitions (WAITING -> FLYING)', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      expect(() => round.transitionTo('FLYING')).toThrow(InvalidStateTransition);
    });

    it('rejects reverse transitions (CRASHED -> BETTING)', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      round.transitionTo('BETTING');
      round.transitionTo('FLYING');
      round.transitionTo('CRASHED');
      expect(() => round.transitionTo('BETTING')).toThrow(InvalidStateTransition);
    });

    it('rejects any transition from SETTLED', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      round.transitionTo('BETTING');
      round.transitionTo('FLYING');
      round.transitionTo('CRASHED');
      round.transitionTo('SETTLED');

      const statuses: RoundStatus[] = ['WAITING', 'BETTING', 'FLYING', 'CRASHED', 'SETTLED'];
      for (const status of statuses) {
        expect(() => round.transitionTo(status)).toThrow(InvalidStateTransition);
      }
    });

    it('rejects WAITING -> CRASHED (skip)', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      expect(() => round.transitionTo('CRASHED')).toThrow(InvalidStateTransition);
    });
  });

  describe('recordCrash', () => {
    it('records crash point when status is CRASHED', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      round.transitionTo('BETTING');
      round.transitionTo('FLYING');
      round.transitionTo('CRASHED');
      round.recordCrash('2.35');
      expect(round.crashPoint).toBe('2.35');
    });

    it('rejects crash point below 1.0', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      round.transitionTo('BETTING');
      round.transitionTo('FLYING');
      round.transitionTo('CRASHED');
      expect(() => round.recordCrash('0.50')).toThrow(InvalidCrashPointError);
    });

    it('rejects non-numeric crash point', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      round.transitionTo('BETTING');
      round.transitionTo('FLYING');
      round.transitionTo('CRASHED');
      expect(() => round.recordCrash('not-a-number')).toThrow(InvalidCrashPointError);
    });

    it('rejects NaN string as crash point', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      round.transitionTo('BETTING');
      round.transitionTo('FLYING');
      round.transitionTo('CRASHED');
      expect(() => round.recordCrash('NaN')).toThrow(InvalidCrashPointError);
    });

    it('rejects Infinity as crash point', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      round.transitionTo('BETTING');
      round.transitionTo('FLYING');
      round.transitionTo('CRASHED');
      expect(() => round.recordCrash('Infinity')).toThrow(InvalidCrashPointError);
    });

    it('rejects recording crash when not in CRASHED state', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      round.transitionTo('BETTING');
      round.transitionTo('FLYING');
      expect(() => round.recordCrash('2.35')).toThrow(InvalidStateTransition);
    });

    it('accepts crash point of exactly 1.00', () => {
      const round = RoundRecord.create('r-1', 'op-1', 10000);
      round.transitionTo('BETTING');
      round.transitionTo('FLYING');
      round.transitionTo('CRASHED');
      round.recordCrash('1.00');
      expect(round.crashPoint).toBe('1.00');
    });
  });

  describe('fromPersistence', () => {
    it('reconstitutes all fields correctly', () => {
      const now = new Date();
      const round = RoundRecord.fromPersistence({
        id: 'r-1',
        operatorId: 'op-1',
        status: 'CRASHED',
        bettingWindowMs: 10000,
        crashPoint: '3.50',
        startedAt: now,
        crashedAt: now,
        settledAt: null,
        createdAt: now,
      });

      expect(round.id).toBe('r-1');
      expect(round.status).toBe('CRASHED');
      expect(round.crashPoint).toBe('3.50');
      expect(round.startedAt).toBe(now);
      expect(round.crashedAt).toBe(now);
      expect(round.settledAt).toBeNull();
    });

    it('allows transition from reconstituted state', () => {
      const round = RoundRecord.fromPersistence({
        id: 'r-1',
        operatorId: 'op-1',
        status: 'CRASHED',
        bettingWindowMs: 10000,
        crashPoint: '2.00',
        startedAt: new Date(),
        crashedAt: new Date(),
        settledAt: null,
        createdAt: new Date(),
      });
      round.transitionTo('SETTLED');
      expect(round.status).toBe('SETTLED');
    });

    it('rejects CRASHED state without crash point', () => {
      expect(() =>
        RoundRecord.fromPersistence({
          id: 'r-1',
          operatorId: 'op-1',
          status: 'CRASHED',
          bettingWindowMs: 10000,
          crashPoint: null,
          startedAt: new Date(),
          crashedAt: new Date(),
          settledAt: null,
          createdAt: new Date(),
        }),
      ).toThrow(InvalidCrashPointError);
    });

    it('rejects SETTLED state without crash point', () => {
      expect(() =>
        RoundRecord.fromPersistence({
          id: 'r-1',
          operatorId: 'op-1',
          status: 'SETTLED',
          bettingWindowMs: 10000,
          crashPoint: null,
          startedAt: new Date(),
          crashedAt: new Date(),
          settledAt: new Date(),
          createdAt: new Date(),
        }),
      ).toThrow(InvalidCrashPointError);
    });

    it('rejects FLYING state without startedAt', () => {
      expect(() =>
        RoundRecord.fromPersistence({
          id: 'r-1',
          operatorId: 'op-1',
          status: 'FLYING',
          bettingWindowMs: 10000,
          crashPoint: null,
          startedAt: null,
          crashedAt: null,
          settledAt: null,
          createdAt: new Date(),
        }),
      ).toThrow(InvalidStateTransition);
    });
  });
});
