export interface AuthPayload {
  readonly playerId: string;
  readonly operatorId: string;
}

export interface AuthGateway {
  verify(token: string): AuthPayload | null;
}
