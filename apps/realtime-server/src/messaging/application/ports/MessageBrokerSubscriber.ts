export interface MessageBrokerSubscriber {
  onRoundNew(handler: (data: { roundId: string; hashedSeed: string }) => void): void;
  onRoundBetting(handler: (data: { roundId: string; endsAt: number }) => void): void;
  onRoundStarted(handler: (data: { roundId: string }) => void): void;
  onRoundCrashed(handler: (data: { roundId: string; crashPoint: number; serverSeed: string }) => void): void;
  onTick(handler: (data: { roundId: string; multiplier: number; elapsedMs: number }) => void): void;
  onBetPlaced(handler: (data: { betId: string; playerId: string; roundId: string; amountCents: number }) => void): void;
  onBetWon(handler: (data: { betId: string; playerId: string; roundId: string; amountCents: number; cashoutMultiplier: number; payoutCents: number }) => void): void;
  onBetLost(handler: (data: { betId: string; playerId: string; roundId: string; amountCents: number; crashPoint: number }) => void): void;
  onBetRejected(handler: (data: { playerId: string; roundId: string; amountCents: number; error: string }) => void): void;
  onCreditFailed(handler: (data: { playerId: string; betId: string; roundId: string; payoutCents: number; reason: string }) => void): void;
  close(): Promise<void>;
}
