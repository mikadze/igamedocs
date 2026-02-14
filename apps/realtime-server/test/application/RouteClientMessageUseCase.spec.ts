import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RouteClientMessageUseCase,
  type RouteInput,
  type ForwardBetCommand,
  type ForwardCashoutCommand,
} from '@messaging/application/RouteClientMessageUseCase';
import type { PlayerConnectionLookup } from '@shared/ports/PlayerConnectionLookup';
import type { Logger } from '@shared/ports/Logger';
import { ConnectionId } from '@connection/domain/ConnectionId';
import { Connection } from '@connection/domain/Connection';
import type { ClientMessage } from '@messaging/domain/ClientMessage';

describe('RouteClientMessageUseCase', () => {
  let connectionStore: PlayerConnectionLookup;
  let forwardBet: ForwardBetCommand;
  let forwardCashout: ForwardCashoutCommand;
  let logger: Logger;
  let useCase: RouteClientMessageUseCase;
  let connection: Connection;
  const connId = ConnectionId.from('conn-1');

  beforeEach(() => {
    connection = Connection.create(connId, 'player-1', 'operator-a', Date.now());
    connection.joinRoom();

    connectionStore = {
      getById: vi.fn(() => connection),
      getByPlayerId: vi.fn(() => connection),
    };

    forwardBet = {
      execute: vi.fn(() => ({ success: true as const })),
    };

    forwardCashout = {
      execute: vi.fn(() => ({ success: true as const })),
    };

    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    useCase = new RouteClientMessageUseCase(
      connectionStore,
      forwardBet,
      forwardCashout,
      logger,
    );
  });

  const makeInput = (message: ClientMessage): RouteInput => ({
    connectionId: connId,
    message,
  });

  describe('place_bet', () => {
    it('delegates to ForwardBetCommand with correct input', () => {
      const message: ClientMessage = {
        type: 'place_bet',
        idempotencyKey: 'idem-1',
        roundId: 'round-1',
        amountCents: 5000,
        autoCashout: 2.5,
      };

      const result = useCase.execute(makeInput(message));

      expect(result).toEqual({ success: true });
      expect(forwardBet.execute).toHaveBeenCalledWith({
        playerId: 'player-1',
        idempotencyKey: 'idem-1',
        roundId: 'round-1',
        amountCents: 5000,
        autoCashout: 2.5,
      });
    });

    it('passes through ForwardBetCommand failure result', () => {
      vi.mocked(forwardBet.execute).mockReturnValue({
        success: false,
        error: 'INVALID_AMOUNT',
      });

      const result = useCase.execute(
        makeInput({
          type: 'place_bet',
          idempotencyKey: 'k',
          roundId: 'r',
          amountCents: -1,
        }),
      );

      expect(result).toEqual({ success: false, error: 'INVALID_AMOUNT' });
    });
  });

  describe('cashout', () => {
    it('delegates to ForwardCashoutCommand with correct input', () => {
      const message: ClientMessage = {
        type: 'cashout',
        roundId: 'round-1',
        betId: 'bet-1',
      };

      const result = useCase.execute(makeInput(message));

      expect(result).toEqual({ success: true });
      expect(forwardCashout.execute).toHaveBeenCalledWith({
        playerId: 'player-1',
        roundId: 'round-1',
        betId: 'bet-1',
      });
    });

    it('passes through ForwardCashoutCommand failure result', () => {
      vi.mocked(forwardCashout.execute).mockReturnValue({
        success: false,
        error: 'NOT_JOINED',
      });

      const result = useCase.execute(
        makeInput({ type: 'cashout', roundId: 'r', betId: 'b' }),
      );

      expect(result).toEqual({ success: false, error: 'NOT_JOINED' });
    });
  });

  describe('connection lookup', () => {
    it('returns CONNECTION_NOT_FOUND when connection missing', () => {
      vi.mocked(connectionStore.getById).mockReturnValue(undefined);

      const result = useCase.execute(
        makeInput({ type: 'place_bet', idempotencyKey: 'k', roundId: 'r', amountCents: 100 }),
      );

      expect(result).toEqual({ success: false, error: 'CONNECTION_NOT_FOUND' });
      expect(forwardBet.execute).not.toHaveBeenCalled();
    });
  });

  describe('re_auth', () => {
    it('returns failure result for unimplemented re_auth', () => {
      const result = useCase.execute(makeInput({ type: 're_auth', token: 'jwt-token' }));

      expect(result).toEqual({ success: false, error: 'RE_AUTH_NOT_IMPLEMENTED' });
    });
  });

  describe('ping', () => {
    it('returns failure result for ping (transport layer concern)', () => {
      const result = useCase.execute(makeInput({ type: 'ping' }));

      expect(result).toEqual({ success: false, error: 'PING_HANDLED_AT_TRANSPORT' });
    });
  });
});
