import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForwardCashoutCommandUseCase } from '@messaging/application/ForwardCashoutCommandUseCase';
import type { ForwardCashoutInput } from '@messaging/application/ForwardCashoutCommandUseCase';
import type { PlayerConnectionLookup } from '@shared/ports/PlayerConnectionLookup';
import type { MessageBrokerPublisher } from '@messaging/application/ports/MessageBrokerPublisher';
import type { Logger } from '@shared/ports/Logger';
import type { RateLimiter } from '@shared/ports/RateLimiter';
import { Connection } from '@connection/domain/Connection';
import { ConnectionId } from '@connection/domain/ConnectionId';

function createMockConnectionStore(): PlayerConnectionLookup {
  return {
    getById: vi.fn(),
    getByPlayerId: vi.fn(),
  };
}

function createMockPublisher(): MessageBrokerPublisher {
  return {
    publishPlaceBet: vi.fn(),
    publishCashout: vi.fn(),
  };
}

function createMockLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createMockRateLimiter(): RateLimiter {
  return { allow: vi.fn(() => true) };
}

function createJoinedConnection(playerId: string): Connection {
  const conn = Connection.create(
    ConnectionId.generate(),
    playerId,
    'operator-a',
    Date.now(),
  );
  conn.joinRoom();
  return conn;
}

const validInput: ForwardCashoutInput = {
  playerId: 'player-1',
  roundId: 'round-1',
  betId: 'bet-1',
};

describe('ForwardCashoutCommandUseCase', () => {
  let connectionStore: PlayerConnectionLookup;
  let publisher: MessageBrokerPublisher;
  let logger: Logger;
  let rateLimiter: RateLimiter;
  let useCase: ForwardCashoutCommandUseCase;

  beforeEach(() => {
    connectionStore = createMockConnectionStore();
    publisher = createMockPublisher();
    logger = createMockLogger();
    rateLimiter = createMockRateLimiter();
    useCase = new ForwardCashoutCommandUseCase(
      connectionStore,
      publisher,
      logger,
      rateLimiter,
    );
  });

  it('returns success and publishes when player is JOINED', () => {
    const conn = createJoinedConnection('player-1');
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

    const result = useCase.execute(validInput);

    expect(result).toEqual({ success: true });
    expect(publisher.publishCashout).toHaveBeenCalledOnce();
  });

  it('returns RATE_LIMITED when rate limiter denies', () => {
    vi.mocked(rateLimiter.allow).mockReturnValue(false);

    const result = useCase.execute(validInput);

    expect(result).toEqual({ success: false, error: 'RATE_LIMITED' });
    expect(publisher.publishCashout).not.toHaveBeenCalled();
  });

  it('calls rate limiter with playerId and action', () => {
    const conn = createJoinedConnection('player-1');
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

    useCase.execute(validInput);

    expect(rateLimiter.allow).toHaveBeenCalledWith('player-1', 'cashout');
  });

  it('returns NOT_JOINED when player has no connection', () => {
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(undefined);

    const result = useCase.execute(validInput);

    expect(result).toEqual({ success: false, error: 'NOT_JOINED' });
    expect(publisher.publishCashout).not.toHaveBeenCalled();
  });

  it('returns NOT_JOINED when player is not JOINED', () => {
    const conn = Connection.create(
      ConnectionId.generate(),
      'player-1',
      'operator-a',
      Date.now(),
    );
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

    const result = useCase.execute(validInput);

    expect(result).toEqual({ success: false, error: 'NOT_JOINED' });
    expect(publisher.publishCashout).not.toHaveBeenCalled();
  });

  it('passes correct payload to publisher', () => {
    const conn = createJoinedConnection('player-1');
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

    useCase.execute(validInput);

    expect(publisher.publishCashout).toHaveBeenCalledWith({
      playerId: 'player-1',
      roundId: 'round-1',
      betId: 'bet-1',
    });
  });

  it('does not publish when player is not joined', () => {
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(undefined);

    useCase.execute(validInput);

    expect(publisher.publishCashout).not.toHaveBeenCalled();
  });

  it('logs info on successful forward', () => {
    const conn = createJoinedConnection('player-1');
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

    useCase.execute(validInput);

    expect(logger.info).toHaveBeenCalledWith(
      'Forwarded cashout command',
      expect.objectContaining({
        playerId: 'player-1',
        roundId: 'round-1',
        betId: 'bet-1',
      }),
    );
  });
});
