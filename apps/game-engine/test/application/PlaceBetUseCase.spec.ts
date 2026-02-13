import { PlaceBetUseCase } from '@betting/application/PlaceBetUseCase';
import { PlaceBetCommand } from '@betting/application/commands/PlaceBetCommand';
import { WalletGateway, WalletResult } from '@betting/application/ports/WalletGateway';
import { BetStore } from '@betting/application/ports/BetStore';
import { FailedCreditStore } from '@betting/application/ports/FailedCreditStore';
import { GameConfig } from '@shared/kernel/GameConfig';
import { Logger } from '@shared/ports/Logger';
import { Round } from '@engine/domain/Round';
import { CrashPoint } from '@shared/kernel/CrashPoint';
import { Money } from '@shared/kernel/Money';
import { Bet } from '@engine/domain/Bet';

describe('PlaceBetUseCase', () => {
  const config: GameConfig = {
    houseEdgePercent: 4,
    minBetCents: 100,
    maxBetCents: 1000000,
    bettingWindowMs: 5000,
    tickIntervalMs: 50,
  };

  let walletGateway: WalletGateway;
  let betStore: BetStore;
  let failedCreditStore: FailedCreditStore;
  let logger: Logger;
  let useCase: PlaceBetUseCase;
  let round: Round;

  const successWalletResult: WalletResult = {
    success: true,
    transactionId: 'tx-1',
    newBalance: Money.fromCents(9000),
  };

  beforeEach(() => {
    walletGateway = {
      debit: jest.fn(async () => successWalletResult),
      credit: jest.fn(async () => successWalletResult),
      getBalance: jest.fn(async () => Money.fromCents(10000)),
    };
    betStore = {
      add: jest.fn(),
      getById: jest.fn(),
      getByRound: jest.fn(() => []),
      getActiveByRound: jest.fn(() => []),
    };
    failedCreditStore = {
      save: jest.fn(),
      getUnresolved: jest.fn(() => []),
      markResolved: jest.fn(),
    };
    logger = { warn: jest.fn(), error: jest.fn() };
    useCase = new PlaceBetUseCase(config, walletGateway, betStore, failedCreditStore, logger);

    round = new Round('round-1', CrashPoint.of(2.0), 'hashed-seed');
    round.openBetting();
  });

  const makeCommand = (overrides?: Partial<PlaceBetCommand>): PlaceBetCommand => ({
    playerId: 'player-1',
    roundId: 'round-1',
    amountCents: 1000,
    ...overrides,
  });

  it('places a bet successfully and returns a snapshot', async () => {
    const result = await useCase.execute(makeCommand(), round);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.betId).toBeDefined();
    }
  });

  it('debits the wallet with correct amount', async () => {
    await useCase.execute(makeCommand({ amountCents: 5000 }), round);

    expect(walletGateway.debit).toHaveBeenCalledWith(
      'player-1',
      Money.fromCents(5000),
      'round-1',
      expect.any(String),
    );
  });

  it('returns the snapshot with correct properties', async () => {
    const result = await useCase.execute(
      makeCommand({ amountCents: 2000 }),
      round,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.snapshot.playerId).toBe('player-1');
      expect(result.snapshot.roundId).toBe('round-1');
      expect(result.snapshot.amountCents).toBe(2000);
    }
  });

  it('adds bet to round on success', async () => {
    const result = await useCase.execute(makeCommand(), round);

    expect(result.success).toBe(true);
    expect(round.bets.size).toBe(1);
  });

  it('adds bet to betStore on success', async () => {
    await useCase.execute(makeCommand(), round);

    expect(betStore.add).toHaveBeenCalledTimes(1);
    expect(betStore.add).toHaveBeenCalledWith(expect.any(Bet));
  });

  it('rejects bet below minimum', async () => {
    const result = await useCase.execute(makeCommand({ amountCents: 50 }), round);

    expect(result).toEqual({ success: false, error: 'BELOW_MIN_BET' });
    expect(walletGateway.debit).not.toHaveBeenCalled();
  });

  it('rejects bet above maximum', async () => {
    const result = await useCase.execute(makeCommand({ amountCents: 2000000 }), round);

    expect(result).toEqual({ success: false, error: 'ABOVE_MAX_BET' });
    expect(walletGateway.debit).not.toHaveBeenCalled();
  });

  it('returns INSUFFICIENT_FUNDS when wallet debit fails', async () => {
    (walletGateway.debit as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'INSUFFICIENT_FUNDS',
    });

    const result = await useCase.execute(makeCommand(), round);

    expect(result).toEqual({ success: false, error: 'INSUFFICIENT_FUNDS' });
  });

  it('returns PLAYER_BLOCKED when wallet debit fails', async () => {
    (walletGateway.debit as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'PLAYER_BLOCKED',
    });

    const result = await useCase.execute(makeCommand(), round);

    expect(result).toEqual({ success: false, error: 'PLAYER_BLOCKED' });
  });

  it('returns WALLET_TIMEOUT when wallet times out', async () => {
    (walletGateway.debit as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'TIMEOUT',
    });

    const result = await useCase.execute(makeCommand(), round);

    expect(result).toEqual({ success: false, error: 'WALLET_TIMEOUT' });
  });

  it('accepts bet at exact minimum', async () => {
    const result = await useCase.execute(makeCommand({ amountCents: 100 }), round);
    expect(result.success).toBe(true);
  });

  it('accepts bet at exact maximum', async () => {
    const result = await useCase.execute(makeCommand({ amountCents: 1000000 }), round);
    expect(result.success).toBe(true);
  });

  it('returns ROUND_NOT_BETTING and initiates compensating refund when round.addBet throws', async () => {
    round.startFlying();

    const result = await useCase.execute(makeCommand(), round);

    expect(result).toEqual({ success: false, error: 'ROUND_NOT_BETTING' });
    expect(walletGateway.credit).toHaveBeenCalledWith(
      'player-1',
      Money.fromCents(1000),
      'round-1',
      expect.any(String),
    );
  });
});
