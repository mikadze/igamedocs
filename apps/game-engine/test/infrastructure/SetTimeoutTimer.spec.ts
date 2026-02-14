import { SetTimeoutTimer } from '@engine/infrastructure/SetTimeoutTimer';

describe('SetTimeoutTimer', () => {
  let timer: SetTimeoutTimer;

  beforeEach(() => {
    jest.useFakeTimers();
    timer = new SetTimeoutTimer();
  });

  afterEach(() => {
    timer.clear();
    jest.useRealTimers();
  });

  describe('schedule', () => {
    it('calls callback after specified delay', () => {
      const cb = jest.fn();
      timer.schedule(cb, 100);

      jest.advanceTimersByTime(99);
      expect(cb).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('clears previous timer when called again', () => {
      const first = jest.fn();
      const second = jest.fn();

      timer.schedule(first, 100);
      timer.schedule(second, 100);

      jest.advanceTimersByTime(100);
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });
  });

  describe('scheduleImmediate', () => {
    it('calls callback asynchronously via setImmediate', () => {
      const cb = jest.fn();
      timer.scheduleImmediate(cb);

      expect(cb).not.toHaveBeenCalled();

      jest.advanceTimersByTime(0);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear', () => {
    it('prevents pending callback from firing', () => {
      const cb = jest.fn();
      timer.schedule(cb, 100);
      timer.clear();

      jest.advanceTimersByTime(200);
      expect(cb).not.toHaveBeenCalled();
    });

    it('is idempotent', () => {
      expect(() => {
        timer.clear();
        timer.clear();
      }).not.toThrow();
    });

    it('does not affect scheduleImmediate callbacks', () => {
      const cb = jest.fn();
      timer.scheduleImmediate(cb);
      timer.clear();

      jest.advanceTimersByTime(0);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });
});
