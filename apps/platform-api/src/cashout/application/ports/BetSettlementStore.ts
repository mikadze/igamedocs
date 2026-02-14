export interface BetSettlementStore {
  recordCashout(
    betId: string,
    cashoutMultiplier: string,
    payout: string,
  ): Promise<void>;

  settleLosingBets(roundId: string): Promise<number>;
}
