import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForwardBetCommandUseCase } from '@messaging/application/ForwardBetCommandUseCase';
import type { ForwardBetInput } from '@messaging/application/ForwardBetCommandUseCase';
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
    publishPlaceBet: vi.fn(() => true),
    publishCashout: vi.fn(() => true),
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

const validInput: ForwardBetInput = {
  playerId: 'player-1',
  idempotencyKey: 'idem-1',
  roundId: 'round-1',
  amountCents: 1000,
};

describe('ForwardBetCommandUseCase', () => {
  let connectionStore: PlayerConnectionLookup;
  let publisher: MessageBrokerPublisher;
  let logger: Logger;
  let rateLimiter: RateLimiter;
  let useCase: ForwardBetCommandUseCase;

  beforeEach(() => {
    connectionStore = createMockConnectionStore();
    publisher = createMockPublisher();
    logger = createMockLogger();
    rateLimiter = createMockRateLimiter();
    useCase = new ForwardBetCommandUseCase(connectionStore, publisher, logger, rateLimiter);
  });

  it('returns success and publishes when input is valid and player is JOINED', () => {
    const conn = createJoinedConnection('player-1');
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

    const result = useCase.execute(validInput);

    expect(result).toEqual({ success: true });
    expect(publisher.publishPlaceBet).toHaveBeenCalledOnce();
  });

  it('returns INVALID_AMOUNT when amountCents is 0', () => {
    const result = useCase.execute({ ...validInput, amountCents: 0 });

    expect(result).toEqual({ success: false, error: 'INVALID_AMOUNT' });
    expect(publisher.publishPlaceBet).not.toHaveBeenCalled();
  });

  it('returns INVALID_AMOUNT when amountCents is negative', () => {
    const result = useCase.execute({ ...validInput, amountCents: -100 });

    expect(result).toEqual({ success: false, error: 'INVALID_AMOUNT' });
    expect(publisher.publishPlaceBet).not.toHaveBeenCalled();
  });

  it('returns INVALID_AMOUNT when amountCents is a float', () => {
    const result = useCase.execute({ ...validInput, amountCents: 99.5 });

    expect(result).toEqual({ success: false, error: 'INVALID_AMOUNT' });
    expect(publisher.publishPlaceBet).not.toHaveBeenCalled();
  });

  it('returns INVALID_AUTOCASHOUT when autoCashout is <= 1.0', () => {
    const conn = createJoinedConnection('player-1');
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

    const result = useCase.execute({ ...validInput, autoCashout: 1.0 });

    expect(result).toEqual({ success: false, error: 'INVALID_AUTOCASHOUT' });
    expect(publisher.publishPlaceBet).not.toHaveBeenCalled();
  });

  it('accepts autoCashout > 1.0', () => {
    const conn = createJoinedConnection('player-1');
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

    const result = useCase.execute({ ...validInput, autoCashout: 1.01 });

    expect(result).toEqual({ success: true });
  });

  it('returns RATE_LIMITED when rate limiter denies', () => {
    vi.mocked(rateLimiter.allow).mockReturnValue(false);

    const result = useCase.execute(validInput);

    expect(result).toEqual({ success: false, error: 'RATE_LIMITED' });
    expect(publisher.publishPlaceBet).not.toHaveBeenCalled();
  });

  it('calls rate limiter with playerId and action', () => {
    const conn = createJoinedConnection('player-1');
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

    useCase.execute(validInput);

    expect(rateLimiter.allow).toHaveBeenCalledWith('player-1', 'place_bet');
  });

  it('returns NOT_JOINED when player has no connection', () => {
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(undefined);

    const result = useCase.execute(validInput);

    expect(result).toEqual({ success: false, error: 'NOT_JOINED' });
    expect(publisher.publishPlaceBet).not.toHaveBeenCalled();
  });

  it('returns NOT_JOINED when player is AUTHENTICATED but not JOINED', () => {
    const conn = Connection.create(
      ConnectionId.generate(),
      'player-1',
      'operator-a',
      Date.now(),
    );
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

    const result = useCase.execute(validInput);

    expect(result).toEqual({ success: false, error: 'NOT_JOINED' });
    expect(publisher.publishPlaceBet).not.toHaveBeenCalled();
  });

  it('passes correct payload to publisher', () => {
    const conn = createJoinedConnection('player-1');
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

    useCase.execute(validInput);

    expect(publisher.publishPlaceBet).toHaveBeenCalledWith({
      idempotencyKey: 'idem-1',
      playerId: 'player-1',
      roundId: 'round-1',
      amountCents: 1000,
      autoCashout: undefined,
    });
  });

  it('passes autoCashout to publisher when provided', () => {
    const conn = createJoinedConnection('player-1');
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

    useCase.execute({ ...validInput, autoCashout: 2.5 });

    expect(publisher.publishPlaceBet).toHaveBeenCalledWith(
      expect.objectContaining({ autoCashout: 2.5 }),
    );
  });

  it('validates amount before checking connection', () => {
    const result = useCase.execute({ ...validInput, amountCents: -1 });

    expect(result).toEqual({ success: false, error: 'INVALID_AMOUNT' });
    expect(connectionStore.getByPlayerId).not.toHaveBeenCalled();
  });

  it('logs info on successful forward', () => {
    const conn = createJoinedConnection('player-1');
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);

    useCase.execute(validInput);

    expect(logger.info).toHaveBeenCalledWith(
      'Forwarded place_bet command',
      expect.objectContaining({
        playerId: 'player-1',
        roundId: 'round-1',
        amountCents: 1000,
      }),
    );
  });

  it('returns PUBLISH_FAILED when publisher returns false', () => {
    const conn = createJoinedConnection('player-1');
    vi.mocked(connectionStore.getByPlayerId).mockReturnValue(conn);
    vi.mocked(publisher.publishPlaceBet).mockReturnValue(false);

    const result = useCase.execute(validInput);

    expect(result).toEqual({ success: false, error: 'PUBLISH_FAILED' });
    expect(logger.info).not.toHaveBeenCalled();
  });
});
