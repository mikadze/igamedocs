import { FailedCredit } from '@betting/application/commands/FailedCredit';

export interface FailedCreditStore {
  save(record: FailedCredit): void;
  getUnresolved(): FailedCredit[];
  markResolved(id: string): void;
}
