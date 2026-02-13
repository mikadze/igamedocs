export interface CreditFailedNotifier {
  creditFailed(
    playerId: string,
    betId: string,
    roundId: string,
    payoutCents: number,
    reason: string,
  ): Promise<void>;
}
