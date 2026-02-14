import { Timer } from '@engine/application/ports/Timer';

export class SetTimeoutTimer implements Timer {
  private handle: ReturnType<typeof setTimeout> | null = null;

  schedule(callback: () => void, delayMs: number): void {
    this.clear();
    this.handle = setTimeout(callback, delayMs);
  }

  scheduleImmediate(callback: () => void): void {
    setImmediate(callback);
  }

  clear(): void {
    if (this.handle !== null) {
      clearTimeout(this.handle);
      this.handle = null;
    }
  }
}
