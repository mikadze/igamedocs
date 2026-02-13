export interface Timer {
  schedule(callback: () => void, delayMs: number): void;
  scheduleImmediate(callback: () => void): void;
  clear(): void;
}
