import { CashoutUseCase } from '@betting/application/CashoutUseCase';
import { WalletGateway, WalletResult } from '@betting/application/ports/WalletGateway';
import { FailedCreditStore } from '@betting/application/ports/FailedCreditStore';
import { EventPublisher } from '@engine/application/ports/EventPublisher';
import { Money } from '@shared/kernel/Money';
import { Round } from '@engine/domain/Round';
import { CrashPoint } from '@engine/domain/CrashPoint';
import { Bet } from '@betting/domain/Bet';
import { BetStatus } from '@betting/domain/BetStatus';

describe('CashoutUseCase', () => {
  let walletGateway: WalletGateway;
  let failedCreditStore: FailedCreditStore;
  let eventPublisher: EventPublisher;
  let useCase: CashoutUseCase;
  let round: Round;

  const successWalletResult: WalletResult = {
    success: true,
    transactionId: 'tx-1',
    newBalance: Money.fromCents(12000),
  };

  function addActiveBet(
    betId: string,
    playerId: string,
    amountCents: number,
    autoCashout?: number,
  ): Bet {
    const bet = new Bet(betId, playerId, round.id, Money.fromCents(amountCents), autoCashout);
    round.addBet(bet);
    return bet;
  }

  beforeEach(() => {
    walletGateway = {
      debit: jest.fn(async () => successWalletResult),
      credit: jest.fn(async () => successWalletResult),
      getBalance: jest.fn(async () => Money.fromCents(10000)),
    };
    failedCreditStore = {
      save: jest.fn(),
      getUnresolved: jest.fn(() => []),
      markResolved: jest.fn(),
    };
    eventPublisher = {
      roundNew: jest.fn(async () => {}),
      roundBetting: jest.fn(async () => {}),
      roundStarted: jest.fn(async () => {}),
      roundCrashed: jest.fn(async () => {}),
      tick: jest.fn(async () => {}),
      betPlaced: jest.fn(async () => {}),
      betWon: jest.fn(async () => {}),
      betLost: jest.fn(async () => {}),
      betRejected: jest.fn(async () => {}),
      creditFailed: jest.fn(async () => {}),
      publishBatch: jest.fn(async () => {}),
    };
    useCase = new CashoutUseCase(walletGateway, failedCreditStore, eventPublisher);

    // Create a round in BETTING state with a high crash point
    round = new Round('round-1', CrashPoint.of(100.0), 'hashed-seed');
    round.openBetting();
  });

  describe('successful cashout', () => {
    it('returns payout and credits wallet for valid cashout', () => {
      addActiveBet('bet-1', 'player-1', 1000);
      round.startFlying();
      round.tick(1.5); // set multiplier to 1.5

      const result = useCase.execute(
        { playerId: 'player-1', roundId: 'round-1', betId: 'bet-1' },
        round,
      );

      expect(result).toEqual({ success: true, payoutCents: 1500 });
      expect(walletGateway.credit).toHaveBeenCalledWith(
        'player-1',
        Money.fromCents(1500),
        'round-1',
        'bet-1',
      );
    });

    it('transitions bet to WON status', () => {
      const bet = addActiveBet('bet-1', 'player-1', 1000);
      round.startFlying();
      round.tick(2.0);

      useCase.execute({ playerId: 'player-1', roundId: 'round-1', betId: 'bet-1' }, round);

      expect(bet.status).toBe(BetStatus.WON);
      expect(bet.payout).toEqual(Money.fromCents(2000));
    });

    it('floors payout to preserve house edge', () => {
      addActiveBet('bet-1', 'player-1', 333);
      round.startFlying();
      round.tick(1.5); // 333 * 1.5 = 499.5 → floor to 499

      const result = useCase.execute(
        { playerId: 'player-1', roundId: 'round-1', betId: 'bet-1' },
        round,
      );

      expect(result).toEqual({ success: true, payoutCents: 499 });
    });

    it('does not persist failure or emit creditFailed on success', async () => {
      addActiveBet('bet-1', 'player-1', 1000);
      round.startFlying();
      round.tick(1.5);

      useCase.execute({ playerId: 'player-1', roundId: 'round-1', betId: 'bet-1' }, round);
      await flushPromises();

      expect(failedCreditStore.save).not.toHaveBeenCalled();
      expect(eventPublisher.creditFailed).not.toHaveBeenCalled();
    });
  });

  describe('BET_NOT_FOUND', () => {
    it('returns error for non-existent bet', () => {
      round.startFlying();

      const result = useCase.execute(
        { playerId: 'player-1', roundId: 'round-1', betId: 'non-existent' },
        round,
      );

      expect(result).toEqual({ success: false, error: 'BET_NOT_FOUND' });
      expect(walletGateway.credit).not.toHaveBeenCalled();
    });
  });

  describe('NOT_BET_OWNER', () => {
    it('returns error when player does not own the bet', () => {
      const bet = addActiveBet('bet-1', 'player-1', 1000);
      round.startFlying();
      round.tick(1.5);

      const result = useCase.execute(
        { playerId: 'player-2', roundId: 'round-1', betId: 'bet-1' },
        round,
      );

      expect(result).toEqual({ success: false, error: 'NOT_BET_OWNER' });
      expect(walletGateway.credit).not.toHaveBeenCalled();
      expect(bet.status).toBe(BetStatus.ACTIVE);
    });
  });

  describe('BET_NOT_ACTIVE', () => {
    it('returns error when bet is already cashed out', () => {
      addActiveBet('bet-1', 'player-1', 1000);
      round.startFlying();
      round.tick(1.5);

      // First cashout succeeds
      useCase.execute({ playerId: 'player-1', roundId: 'round-1', betId: 'bet-1' }, round);

      // Second cashout fails
      const result = useCase.execute(
        { playerId: 'player-1', roundId: 'round-1', betId: 'bet-1' },
        round,
      );

      expect(result).toEqual({ success: false, error: 'BET_NOT_ACTIVE' });
    });
  });

  describe('ROUND_NOT_RUNNING', () => {
    it('returns error when round is in BETTING state', () => {
      addActiveBet('bet-1', 'player-1', 1000);
      // round is still in BETTING (not started flying)

      const result = useCase.execute(
        { playerId: 'player-1', roundId: 'round-1', betId: 'bet-1' },
        round,
      );

      expect(result).toEqual({ success: false, error: 'ROUND_NOT_RUNNING' });
      expect(walletGateway.credit).not.toHaveBeenCalled();
    });
  });

  describe('ROUND_MISMATCH', () => {
    it('returns error when command roundId does not match round', () => {
      addActiveBet('bet-1', 'player-1', 1000);
      round.startFlying();
      round.tick(1.5);

      const result = useCase.execute(
        { playerId: 'player-1', roundId: 'wrong-round', betId: 'bet-1' },
        round,
      );

      expect(result).toEqual({ success: false, error: 'ROUND_MISMATCH' });
      expect(walletGateway.credit).not.toHaveBeenCalled();
    });
  });

  describe('wallet credit failure handling', () => {
    it('returns success even when wallet credit rejects (domain cashout is irreversible)', () => {
      (walletGateway.credit as jest.Mock).mockRejectedValueOnce(
        new Error('network error'),
      );

      addActiveBet('bet-1', 'player-1', 1000);
      round.startFlying();
      round.tick(1.5);

      const result = useCase.execute(
        { playerId: 'player-1', roundId: 'round-1', betId: 'bet-1' },
        round,
      );

      // Domain cashout succeeded, wallet failure is handled asynchronously
      expect(result).toEqual({ success: true, payoutCents: 1500 });
    });

    it('persists failed credit when wallet credit rejects', async () => {
      (walletGateway.credit as jest.Mock).mockRejectedValueOnce(
        new Error('network error'),
      );

      addActiveBet('bet-1', 'player-1', 1000);
      round.startFlying();
      round.tick(1.5);

      useCase.execute({ playerId: 'player-1', roundId: 'round-1', betId: 'bet-1' }, round);
      await flushPromises();

      expect(failedCreditStore.save).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 'player-1',
          roundId: 'round-1',
          betId: 'bet-1',
          payoutCents: 1500,
          reason: 'network error',
          retryCount: 0,
          resolved: false,
        }),
      );
    });

    it('persists failed credit when wallet returns failure result', async () => {
      (walletGateway.credit as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'TIMEOUT',
      });

      addActiveBet('bet-1', 'player-1', 1000);
      round.startFlying();
      round.tick(1.5);

      useCase.execute({ playerId: 'player-1', roundId: 'round-1', betId: 'bet-1' }, round);
      await flushPromises();

      expect(failedCreditStore.save).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 'player-1',
          roundId: 'round-1',
          betId: 'bet-1',
          payoutCents: 1500,
          reason: 'TIMEOUT',
        }),
      );
    });

    it('emits creditFailed event when wallet credit fails', async () => {
      (walletGateway.credit as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'PLAYER_BLOCKED',
      });

      addActiveBet('bet-1', 'player-1', 1000);
      round.startFlying();
      round.tick(1.5);

      useCase.execute({ playerId: 'player-1', roundId: 'round-1', betId: 'bet-1' }, round);
      await flushPromises();

      expect(eventPublisher.creditFailed).toHaveBeenCalledWith(
        'player-1', 'bet-1', 'round-1', 1500, 'PLAYER_BLOCKED',
      );
    });
  });
});

function flushPromises(): Promise<void> {
  return new Promise((resolve) => process.nextTick(resolve));
}
