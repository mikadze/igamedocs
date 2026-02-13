import { GameEvent } from './GameEvent';

/**
 * Double-buffered event collector for the tick hot path.
 *
 * Uses a two-slot pool so that `swap()` never allocates. The caller
 * pushes events during a tick (synchronous, zero I/O), then flushes
 * the buffer between ticks via `swap()`.
 *
 * **Contract:** The array returned by `swap()` is reused after the
 * *next* swap. Consumers (i.e. `EventPublisher.publishBatch`) must
 * synchronously read or copy all elements before their first `await`,
 * otherwise a subsequent `swap()` will clear the underlying array.
 */
export class TickEventBuffer {
  private buffer: GameEvent[] = [];
  private readonly pool: GameEvent[][] = [[], []];
  private activeIndex = 0;

  push(event: GameEvent): void {
    this.buffer.push(event);
  }

  /**
   * Returns the current buffer and switches to the alternate pool slot.
   *
   * **Important:** The returned array reference is recycled on the next
   * call to `swap()` (`pool[n].length = 0`). The caller must finish
   * reading the array synchronously — or copy it — before yielding.
   */
  swap(): GameEvent[] {
    const flushing = this.buffer;
    this.activeIndex = (this.activeIndex + 1) % 2;
    this.buffer = this.pool[this.activeIndex];
    this.buffer.length = 0;
    return flushing;
  }
}
