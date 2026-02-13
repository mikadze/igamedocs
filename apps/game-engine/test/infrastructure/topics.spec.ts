import { createTopics, GameTopics } from '@messaging/topics';

describe('createTopics', () => {
  let topics: GameTopics;

  beforeEach(() => {
    topics = createTopics('op-123');
  });

  it('prefixes round topics with game.{operatorId}.round.*', () => {
    expect(topics.ROUND_NEW).toBe('game.op-123.round.new');
    expect(topics.ROUND_BETTING).toBe('game.op-123.round.betting');
    expect(topics.ROUND_STARTED).toBe('game.op-123.round.started');
    expect(topics.ROUND_CRASHED).toBe('game.op-123.round.crashed');
  });

  it('prefixes bet topics with game.{operatorId}.bet.*', () => {
    expect(topics.BET_PLACED).toBe('game.op-123.bet.placed');
    expect(topics.BET_WON).toBe('game.op-123.bet.won');
    expect(topics.BET_LOST).toBe('game.op-123.bet.lost');
    expect(topics.BET_REJECTED).toBe('game.op-123.bet.rejected');
  });

  it('prefixes tick topic with game.{operatorId}.tick', () => {
    expect(topics.TICK).toBe('game.op-123.tick');
  });

  it('prefixes credit failed topic', () => {
    expect(topics.CREDIT_FAILED).toBe('game.op-123.credit.failed');
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(topics)).toBe(true);
  });

  it('throws on operatorId with NATS special characters', () => {
    expect(() => createTopics('a.b')).toThrow('Invalid operatorId');
    expect(() => createTopics('a*')).toThrow('Invalid operatorId');
    expect(() => createTopics('a>')).toThrow('Invalid operatorId');
  });

  it('produces distinct prefixes for different operator IDs', () => {
    const topicsA = createTopics('operator-a');
    const topicsB = createTopics('operator-b');
    expect(topicsA.ROUND_NEW).toBe('game.operator-a.round.new');
    expect(topicsB.ROUND_NEW).toBe('game.operator-b.round.new');
    expect(topicsA.ROUND_NEW).not.toBe(topicsB.ROUND_NEW);
  });
});
