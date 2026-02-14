import { describe, it, expect } from 'vitest';
import { createTopics, type GameTopics } from '@messaging/infrastructure/topics';

describe('createTopics', () => {
  it('creates operator-prefixed topics', () => {
    const topics = createTopics('operator-a');

    expect(topics.ROUND_NEW).toBe('game.operator-a.round.new');
    expect(topics.ROUND_BETTING).toBe('game.operator-a.round.betting');
    expect(topics.ROUND_STARTED).toBe('game.operator-a.round.started');
    expect(topics.ROUND_CRASHED).toBe('game.operator-a.round.crashed');
    expect(topics.TICK).toBe('game.operator-a.tick');
    expect(topics.BET_PLACED).toBe('game.operator-a.bet.placed');
    expect(topics.BET_WON).toBe('game.operator-a.bet.won');
    expect(topics.BET_LOST).toBe('game.operator-a.bet.lost');
    expect(topics.BET_REJECTED).toBe('game.operator-a.bet.rejected');
    expect(topics.CREDIT_FAILED).toBe('game.operator-a.credit.failed');
    expect(topics.CMD_PLACE_BET).toBe('game.operator-a.cmd.place-bet');
    expect(topics.CMD_CASHOUT).toBe('game.operator-a.cmd.cashout');
  });

  it('returns a frozen object', () => {
    const topics = createTopics('test-op');
    expect(Object.isFrozen(topics)).toBe(true);
  });

  it('has exactly 12 topic constants', () => {
    const topics = createTopics('test-op');
    expect(Object.keys(topics)).toHaveLength(12);
  });
});
