export class ConnectionId {
  private constructor(readonly value: string) {}

  static generate(): ConnectionId {
    return new ConnectionId(crypto.randomUUID());
  }

  static from(value: string): ConnectionId {
    if (!value || value.trim().length === 0) {
      throw new Error('ConnectionId cannot be empty');
    }
    return new ConnectionId(value);
  }

  equals(other: ConnectionId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
