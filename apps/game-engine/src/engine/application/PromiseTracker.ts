import { Logger } from '@shared/ports/Logger';

export class PromiseTracker {
  private readonly pending = new Set<Promise<unknown>>();

  constructor(
    private readonly category: string,
    private readonly highWaterMark: number,
    private readonly logger: Logger,
  ) {}

  track(promise: Promise<unknown>): void {
    this.pending.add(promise);
    promise.finally(() => {
      this.pending.delete(promise);
    });

    if (this.pending.size > this.highWaterMark) {
      this.logger.warn(
        `[PromiseTracker] High water mark exceeded for "${this.category}"`,
        {
          category: this.category,
          pending: this.pending.size,
          highWaterMark: this.highWaterMark,
        },
      );
    }
  }

  get size(): number {
    return this.pending.size;
  }

  async drain(): Promise<void> {
    await Promise.allSettled([...this.pending]);
  }
}
