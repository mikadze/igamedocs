export enum ConnectionState {
  AUTHENTICATED = 'AUTHENTICATED',
  JOINED = 'JOINED',
  DISCONNECTED = 'DISCONNECTED',
}

const validTransitions: Record<ConnectionState, ConnectionState[]> = {
  [ConnectionState.AUTHENTICATED]: [
    ConnectionState.JOINED,
    ConnectionState.DISCONNECTED,
  ],
  [ConnectionState.JOINED]: [ConnectionState.DISCONNECTED],
  [ConnectionState.DISCONNECTED]: [],
};

export function canTransition(
  from: ConnectionState,
  to: ConnectionState,
): boolean {
  return validTransitions[from].includes(to);
}
