import { FailedCreditStore } from '@betting/application/ports/FailedCreditStore';
import { FailedCredit } from '@betting/application/commands/FailedCredit';

export class InMemoryFailedCreditStore implements FailedCreditStore {
  private readonly records: Map<string, FailedCredit> = new Map();

  save(record: FailedCredit): void {
    this.records.set(record.id, record);
  }

  getUnresolved(): FailedCredit[] {
    return Array.from(this.records.values()).filter((r) => !r.resolved);
  }

  markResolved(id: string): void {
    const record = this.records.get(id);
    if (record) {
      record.resolved = true;
    }
  }
}
