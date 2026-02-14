import { Injectable } from '@nestjs/common';
import { TickScheduler } from '@engine/application/ports/TickScheduler';

@Injectable()
export class SetIntervalTickScheduler implements TickScheduler {
  private handle: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;

  constructor(private readonly intervalMs: number) {}

  start(callback: (elapsedMs: number) => void): void {
    this.startTime = performance.now();
    this.handle = setInterval(() => {
      callback(performance.now() - this.startTime);
    }, this.intervalMs);
  }

  stop(): void {
    if (this.handle !== null) {
      clearInterval(this.handle);
      this.handle = null;
    }
  }
}
