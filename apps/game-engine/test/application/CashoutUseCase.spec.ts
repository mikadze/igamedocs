import { CashoutUseCase } from '@betting/application/CashoutUseCase';
import { WalletGateway, WalletResult } from '@betting/application/ports/WalletGateway';
import { Money } from '@shared/kernel/Money';

describe('CashoutUseCase', () => {
  let walletGateway: WalletGateway;
  let useCase: CashoutUseCase;

  const successWalletResult: WalletResult = {
    success: true,
    transactionId: 'tx-1',
    newBalance: Money.fromCents(12000),
  };

  beforeEach(() => {
    walletGateway = {
      debit: jest.fn(async () => successWalletResult),
      credit: jest.fn(async () => successWalletResult),
      getBalance: jest.fn(async () => Money.fromCents(10000)),
    };
    useCase = new CashoutUseCase(walletGateway);
  });

  it('credits wallet and returns payout on success', async () => {
    const payout = Money.fromCents(2500);
    const result = await useCase.creditWinnings('player-1', payout, 'round-1', 'bet-1');

    expect(result).toEqual({ success: true, payoutCents: 2500 });
    expect(walletGateway.credit).toHaveBeenCalledWith(
      'player-1',
      payout,
      'round-1',
      'bet-1',
    );
  });

  it('returns WALLET_TIMEOUT when wallet credit fails', async () => {
    (walletGateway.credit as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'TIMEOUT',
    });

    const payout = Money.fromCents(2500);
    const result = await useCase.creditWinnings('player-1', payout, 'round-1', 'bet-1');

    expect(result).toEqual({ success: false, error: 'WALLET_TIMEOUT' });
  });

  it('passes correct amount to wallet gateway', async () => {
    const payout = Money.fromCents(99900);
    await useCase.creditWinnings('player-2', payout, 'round-5', 'bet-42');

    expect(walletGateway.credit).toHaveBeenCalledWith(
      'player-2',
      payout,
      'round-5',
      'bet-42',
    );
  });
});
