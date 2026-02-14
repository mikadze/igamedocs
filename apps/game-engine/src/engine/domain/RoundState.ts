export enum RoundState {
  WAITING = 'WAITING',
  BETTING = 'BETTING',
  RUNNING = 'RUNNING',
  CRASHED = 'CRASHED',
}

const validTransitions: Record<RoundState, RoundState[]> = {
  [RoundState.WAITING]: [RoundState.BETTING],
  [RoundState.BETTING]: [RoundState.RUNNING],
  [RoundState.RUNNING]: [RoundState.CRASHED],
  [RoundState.CRASHED]: [],
};

export function canTransition(from: RoundState, to: RoundState): boolean {
  return validTransitions[from].includes(to);
}
