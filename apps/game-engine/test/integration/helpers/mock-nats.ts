import type { NatsConnection, Subscription, Msg, Sub, Status } from 'nats';

interface CapturedMessage {
  subject: string;
  payload: unknown;
}

interface PendingWaiter {
  subject: string;
  resolve: (payload: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

type SubscribeCallback = (err: Error | null, msg: Msg) => void;

/**
 * In-memory NatsConnection mock for integration tests.
 *
 * Publishing side: captures all published messages and supports
 * waiting for messages on specific subjects.
 *
 * Subscribing side: captures callbacks registered via subscribe()
 * and allows injecting messages to trigger handlers.
 */
export class MockNatsConnection {
  readonly messages: CapturedMessage[] = [];
  private readonly callbacks = new Map<string, SubscribeCallback>();
  private readonly waiters: PendingWaiter[] = [];
  private closed = false;

  // ── NatsConnection interface subset ──────────────────

  publish(subject: string, data?: Uint8Array): void {
    const payload = data
      ? JSON.parse(new TextDecoder().decode(data))
      : undefined;

    const entry: CapturedMessage = { subject, payload };

    // Check if a waiter is waiting for this subject
    let consumed = false;
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      const waiter = this.waiters[i];
      if (waiter.subject === subject) {
        clearTimeout(waiter.timer);
        this.waiters.splice(i, 1);
        waiter.resolve(payload);
        consumed = true;
        break; // Only resolve one waiter per message
      }
    }

    // Only store the message if no waiter consumed it
    if (!consumed) {
      this.messages.push(entry);
    }
  }

  subscribe(subject: string, opts?: { callback?: SubscribeCallback }): Subscription {
    if (opts?.callback) {
      this.callbacks.set(subject, opts.callback);
    }
    return {
      unsubscribe: () => {},
      drain: () => Promise.resolve(),
      isClosed: () => false,
      getSubject: () => subject,
      getReceived: () => 0,
      getProcessed: () => 0,
      getPending: () => 0,
      getID: () => 0,
      getMax: () => 0,
    } as unknown as Subscription;
  }

  isClosed(): boolean {
    return this.closed;
  }

  isDraining(): boolean {
    return false;
  }

  async drain(): Promise<void> {
    this.closed = true;
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  async flush(): Promise<void> {}

  status(): AsyncIterable<Status> {
    return {
      [Symbol.asyncIterator]() {
        return {
          next: () => new Promise<IteratorResult<Status>>(() => {}),
        };
      },
    };
  }

  // ── Test helpers ─────────────────────────────────────

  /**
   * Waits for a message to be published on the given subject.
   * Returns the decoded JSON payload.
   */
  waitForMessage(subject: string, timeoutMs = 5000): Promise<unknown> {
    // Check if a message already exists
    const existing = this.messages.find((m) => m.subject === subject);
    if (existing) {
      // Remove it so subsequent waits get the next one
      const idx = this.messages.indexOf(existing);
      this.messages.splice(idx, 1);
      return Promise.resolve(existing.payload);
    }

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(waiter);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error(`Timeout waiting for message on ${subject} (${timeoutMs}ms)`));
      }, timeoutMs);

      const waiter: PendingWaiter = { subject, resolve, timer };
      this.waiters.push(waiter);
    });
  }

  /**
   * Collects all messages already published on the given subject.
   */
  messagesFor(subject: string): unknown[] {
    return this.messages
      .filter((m) => m.subject === subject)
      .map((m) => m.payload);
  }

  /**
   * Injects a message to a subscribed subject, simulating an
   * inbound NATS message. Triggers the registered callback.
   */
  injectMessage(subject: string, payload: unknown): void {
    const callback = this.callbacks.get(subject);
    if (!callback) {
      throw new Error(
        `No subscription registered for subject "${subject}". ` +
        `Registered subjects: ${Array.from(this.callbacks.keys()).join(', ')}`,
      );
    }

    const msg = {
      subject,
      data: new TextEncoder().encode(JSON.stringify(payload)),
      json: () => payload,
      string: () => JSON.stringify(payload),
      headers: null,
      sid: 0,
      reply: undefined,
      respond: () => false,
    } as unknown as Msg;

    callback(null, msg);
  }

  /**
   * Clears all captured messages and waiters.
   */
  reset(): void {
    this.messages.length = 0;
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
    }
    this.waiters.length = 0;
  }
}
