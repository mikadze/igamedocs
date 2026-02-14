export interface TokenPayload {
  sub: string;
  operatorId: string;
  operatorPlayerId: string;
  currency: string;
  sessionId: string;
  type?: 'access' | 'refresh';
}
