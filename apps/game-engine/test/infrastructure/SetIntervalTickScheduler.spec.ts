import { SetIntervalTickScheduler } from '@engine/infrastructure/SetIntervalTickScheduler';

describe('SetIntervalTickScheduler', () => {
  let scheduler: SetIntervalTickScheduler;

  beforeEach(() => {
    jest.useFakeTimers();
    scheduler = new SetIntervalTickScheduler(50);
  });

  afterEach(() => {
    scheduler.stop();
    jest.useRealTimers();
  });

  it('invokes callback on each tick interval', () => {
    const callback = jest.fn();
    scheduler.start(callback);

    jest.advanceTimersByTime(50);
    expect(callback).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(50);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('does not invoke callback before first interval fires', () => {
    const callback = jest.fn();
    scheduler.start(callback);

    jest.advanceTimersByTime(49);
    expect(callback).not.toHaveBeenCalled();
  });

  it('passes elapsed milliseconds to callback', () => {
    const callback = jest.fn();
    const nowSpy = jest
      .spyOn(performance, 'now')
      .mockReturnValueOnce(1000) // start() call
      .mockReturnValueOnce(1050) // first tick
      .mockReturnValueOnce(1100); // second tick

    scheduler.start(callback);

    jest.advanceTimersByTime(50);
    expect(callback).toHaveBeenCalledWith(50);

    jest.advanceTimersByTime(50);
    expect(callback).toHaveBeenCalledWith(100);

    nowSpy.mockRestore();
  });

  it('stop prevents further callbacks', () => {
    const callback = jest.fn();
    scheduler.start(callback);

    jest.advanceTimersByTime(50);
    expect(callback).toHaveBeenCalledTimes(1);

    scheduler.stop();

    jest.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('stop is idempotent', () => {
    scheduler.start(jest.fn());
    scheduler.stop();
    expect(() => scheduler.stop()).not.toThrow();
  });

  it('stop without start does not throw', () => {
    expect(() => scheduler.stop()).not.toThrow();
  });

  it('uses the configured interval', () => {
    const fast = new SetIntervalTickScheduler(10);
    const callback = jest.fn();
    fast.start(callback);

    jest.advanceTimersByTime(50);
    expect(callback).toHaveBeenCalledTimes(5);

    fast.stop();
  });
});
