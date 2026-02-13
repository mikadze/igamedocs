import { PlaceBetUseCase } from '@betting/application/PlaceBetUseCase';
import { PlaceBetCommand } from '@betting/application/commands/PlaceBetCommand';
import { BetStore } from '@betting/application/ports/BetStore';
import { WalletGateway, WalletResult } from '@betting/application/ports/WalletGateway';
import { Bet } from '@betting/domain/Bet';
import { GameConfig } from '@engine/domain/GameConfig';
import { Money } from '@shared/kernel/Money';

describe('PlaceBetUseCase', () => {
  const config: GameConfig = {
    houseEdgePercent: 4,
    minBetCents: 100,
    maxBetCents: 1000000,
    bettingWindowMs: 5000,
    tickIntervalMs: 50,
  };

  let storedBets: Map<string, Bet>;
  let betStore: BetStore;
  let walletGateway: WalletGateway;
  let useCase: PlaceBetUseCase;

  const successWalletResult: WalletResult = {
    success: true,
    transactionId: 'tx-1',
    newBalance: Money.fromCents(9000),
  };

  beforeEach(() => {
    storedBets = new Map();
    betStore = {
      add: jest.fn((bet: Bet) => storedBets.set(bet.id, bet)),
      getById: jest.fn((id: string) => storedBets.get(id)),
      getByRound: jest.fn(() => []),
      getActiveByRound: jest.fn(() => []),
    };
    walletGateway = {
      debit: jest.fn(async () => successWalletResult),
      credit: jest.fn(async () => successWalletResult),
      getBalance: jest.fn(async () => Money.fromCents(10000)),
    };
    useCase = new PlaceBetUseCase(config, betStore, walletGateway);
  });

  const makeCommand = (overrides?: Partial<PlaceBetCommand>): PlaceBetCommand => ({
    playerId: 'player-1',
    roundId: 'round-1',
    amountCents: 1000,
    ...overrides,
  });

  it('places a bet successfully', async () => {
    const result = await useCase.execute(makeCommand());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.betId).toBeDefined();
      expect(betStore.add).toHaveBeenCalledTimes(1);
    }
  });

  it('debits the wallet with correct amount', async () => {
    await useCase.execute(makeCommand({ amountCents: 5000 }));

    expect(walletGateway.debit).toHaveBeenCalledWith(
      'player-1',
      Money.fromCents(5000),
      'round-1',
      expect.any(String),
    );
  });

  it('stores the bet with correct properties', async () => {
    const result = await useCase.execute(
      makeCommand({ amountCents: 2000, autoCashout: 2.5 }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      const bet = storedBets.get(result.betId)!;
      expect(bet.playerId).toBe('player-1');
      expect(bet.roundId).toBe('round-1');
      expect(bet.amount.toCents()).toBe(2000);
      expect(bet.autoCashout).toBe(2.5);
    }
  });

  it('rejects bet below minimum', async () => {
    const result = await useCase.execute(makeCommand({ amountCents: 50 }));

    expect(result).toEqual({ success: false, error: 'BELOW_MIN_BET' });
    expect(walletGateway.debit).not.toHaveBeenCalled();
    expect(betStore.add).not.toHaveBeenCalled();
  });

  it('rejects bet above maximum', async () => {
    const result = await useCase.execute(makeCommand({ amountCents: 2000000 }));

    expect(result).toEqual({ success: false, error: 'ABOVE_MAX_BET' });
    expect(walletGateway.debit).not.toHaveBeenCalled();
    expect(betStore.add).not.toHaveBeenCalled();
  });

  it('returns INSUFFICIENT_FUNDS when wallet debit fails', async () => {
    (walletGateway.debit as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'INSUFFICIENT_FUNDS',
    });

    const result = await useCase.execute(makeCommand());

    expect(result).toEqual({ success: false, error: 'INSUFFICIENT_FUNDS' });
    expect(betStore.add).not.toHaveBeenCalled();
  });

  it('returns PLAYER_BLOCKED when wallet debit fails', async () => {
    (walletGateway.debit as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'PLAYER_BLOCKED',
    });

    const result = await useCase.execute(makeCommand());

    expect(result).toEqual({ success: false, error: 'PLAYER_BLOCKED' });
  });

  it('returns WALLET_TIMEOUT when wallet times out', async () => {
    (walletGateway.debit as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'TIMEOUT',
    });

    const result = await useCase.execute(makeCommand());

    expect(result).toEqual({ success: false, error: 'WALLET_TIMEOUT' });
  });

  it('accepts bet at exact minimum', async () => {
    const result = await useCase.execute(makeCommand({ amountCents: 100 }));
    expect(result.success).toBe(true);
  });

  it('accepts bet at exact maximum', async () => {
    const result = await useCase.execute(makeCommand({ amountCents: 1000000 }));
    expect(result.success).toBe(true);
  });
});
