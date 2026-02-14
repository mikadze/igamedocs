export interface TickScheduler {
  start(callback: (elapsedMs: number) => void): void;
  stop(): void;
}
