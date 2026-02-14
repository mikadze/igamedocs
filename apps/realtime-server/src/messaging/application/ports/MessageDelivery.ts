export interface MessageDelivery {
  sendToPlayer(playerId: string, data: Uint8Array): void;
  broadcastToAll(data: Uint8Array): void;
}
