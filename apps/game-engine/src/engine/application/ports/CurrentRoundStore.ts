import { Round } from '@engine/domain/Round';

export interface CurrentRoundStore {
  get(): Round | null;
  set(round: Round | null): void;
}
