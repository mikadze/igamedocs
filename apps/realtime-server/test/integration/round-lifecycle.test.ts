import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import {
  createTestServer,
  connectClient,
  createGameEngineSimulator,
  subscribeToCommands,
  delay,
  type TestServerContext,
  type GameEngineSimulator,
  type CapturedCommand,
} from './helpers';

/**
 * RT-5.2 — Full Round Lifecycle E2E Integration Test
 *
 * The test acts as both the browser client (via WebSocket) and the
 * game engine (via NATS publishing). Verifies the complete flow:
 * connect → round.new → place bet → bet.placed → ticks → cashout →
 * bet.won → round.crashed.
 */
describe('RT-5.2: Full Round Lifecycle E2E', () => {
  let ctx: TestServerContext;
  let engine: GameEngineSimulator;
  let commandListener: { commands: CapturedCommand[]; close(): Promise<void> };

  beforeAll(async () => {
    ctx = await createTestServer();
    engine = createGameEngineSimulator(ctx.nc, ctx.topics);
    commandListener = await subscribeToCommands(ctx.nc, ctx.topics);
  });

  afterAll(async () => {
    await commandListener.close();
    await ctx.teardown();
  });

  it('full round: connect → round.new → place bet → bet.placed → ticks → cashout → bet.won → round.crashed', async () => {
    // 1. Connect client
    const token = await ctx.auth.signToken({ playerId: 'e2e-player', operatorId: 'test-op' });
    const client = await connectClient(ctx.url, token);
    await delay(50);

    // 2. Game engine publishes round.new
    engine.publishRoundNew({ roundId: 'e2e-round-1', hashedSeed: 'hash-e2e' });
    const roundNew = await client.waitForMessage('round_new', 3000);
    expect(roundNew.roundId).toBe('e2e-round-1');
    expect(roundNew.hashedSeed).toBe('hash-e2e');

    // 3. Game engine publishes round.betting
    engine.publishRoundBetting({ roundId: 'e2e-round-1', endsAt: Date.now() + 10000 });
    const roundBetting = await client.waitForMessage('round_betting', 3000);
    expect(roundBetting.roundId).toBe('e2e-round-1');

    // 4. Client places a bet
    client.sendPlaceBet({ idempotencyKey: 'idem-e2e-1', roundId: 'e2e-round-1', amountCents: 500 });
    await delay(200);

    // 5. Verify the server forwarded the bet command to NATS
    const betCmd = commandListener.commands.find(
      (c) => c.subject === ctx.topics.CMD_PLACE_BET,
    );
    expect(betCmd).toBeDefined();
    expect((betCmd!.data as any).playerId).toBe('e2e-player');
    expect((betCmd!.data as any).amountCents).toBe(500);
    expect((betCmd!.data as any).idempotencyKey).toBe('idem-e2e-1');

    // 6. Game engine publishes bet.placed
    engine.publishBetPlaced({
      betId: 'bet-e2e-1', playerId: 'e2e-player', roundId: 'e2e-round-1', amountCents: 500, status: 'ACTIVE',
    });
    const betPlaced = await client.waitForMessage('bet_placed', 3000);
    expect(betPlaced.betId).toBe('bet-e2e-1');
    expect(betPlaced.amountCents).toBe(500);

    // 7. Game engine publishes round.started
    engine.publishRoundStarted({ roundId: 'e2e-round-1' });
    const roundStarted = await client.waitForMessage('round_started', 3000);
    expect(roundStarted.roundId).toBe('e2e-round-1');

    // 8. Game engine publishes ticks
    engine.publishTick({ roundId: 'e2e-round-1', multiplier: 1.2, elapsedMs: 200 });
    const tick1 = await client.waitForMessage('tick', 3000);
    expect(tick1.multiplier).toBe(1.2);

    engine.publishTick({ roundId: 'e2e-round-1', multiplier: 1.5, elapsedMs: 500 });
    const tick2 = await client.waitForMessage('tick', 3000);
    expect(tick2.multiplier).toBe(1.5);

    // 9. Client sends cashout
    client.sendCashout({ roundId: 'e2e-round-1', betId: 'bet-e2e-1' });
    await delay(200);

    // 10. Verify cashout command published to NATS
    const cashoutCmd = commandListener.commands.find(
      (c) => c.subject === ctx.topics.CMD_CASHOUT,
    );
    expect(cashoutCmd).toBeDefined();
    expect((cashoutCmd!.data as any).betId).toBe('bet-e2e-1');
    expect((cashoutCmd!.data as any).playerId).toBe('e2e-player');

    // 11. Game engine publishes bet.won
    engine.publishBetWon({
      betId: 'bet-e2e-1', playerId: 'e2e-player', roundId: 'e2e-round-1',
      amountCents: 500, status: 'WON', cashoutMultiplier: 1.5, payoutCents: 750,
    });
    const betWon = await client.waitForMessage('bet_won', 3000);
    expect(betWon.cashoutMultiplier).toBe(1.5);
    expect(betWon.payoutCents).toBe(750);

    // 12. Game engine publishes round.crashed
    engine.publishRoundCrashed({ roundId: 'e2e-round-1', crashPoint: 2.5, serverSeed: 'seed-e2e' });
    const roundCrashed = await client.waitForMessage('round_crashed', 3000);
    expect(roundCrashed.crashPoint).toBe(2.5);
    expect(roundCrashed.serverSeed).toBe('seed-e2e');

    client.close();
  });

  it('broadcast reaches multiple connected clients', async () => {
    const token1 = await ctx.auth.signToken({ playerId: 'multi-p1', operatorId: 'test-op' });
    const token2 = await ctx.auth.signToken({ playerId: 'multi-p2', operatorId: 'test-op' });
    const client1 = await connectClient(ctx.url, token1);
    const client2 = await connectClient(ctx.url, token2);
    await delay(50);

    engine.publishTick({ roundId: 'broadcast-round', multiplier: 1.1, elapsedMs: 100 });

    const tick1 = await client1.waitForMessage('tick', 3000);
    const tick2 = await client2.waitForMessage('tick', 3000);
    expect(tick1.multiplier).toBe(1.1);
    expect(tick2.multiplier).toBe(1.1);

    client1.close();
    client2.close();
    await delay(50);
  });

  it('bet_rejected only reaches the target player', async () => {
    const token1 = await ctx.auth.signToken({ playerId: 'target-rej', operatorId: 'test-op' });
    const token2 = await ctx.auth.signToken({ playerId: 'bystander-rej', operatorId: 'test-op' });
    const client1 = await connectClient(ctx.url, token1);
    const client2 = await connectClient(ctx.url, token2);
    await delay(50);

    engine.publishBetRejected({
      playerId: 'target-rej', roundId: 'rej-round', amountCents: 100, error: 'ROUND_NOT_BETTING',
    });

    const rejected = await client1.waitForMessage('bet_rejected', 3000);
    expect(rejected.error).toBe('ROUND_NOT_BETTING');

    // Bystander should NOT receive bet_rejected
    await delay(300);
    const bystander = client2.messages.find((m) => m.type === 'bet_rejected');
    expect(bystander).toBeUndefined();

    client1.close();
    client2.close();
    await delay(50);
  });

  it('credit_failed only reaches the target player', async () => {
    const token1 = await ctx.auth.signToken({ playerId: 'target-cf', operatorId: 'test-op' });
    const token2 = await ctx.auth.signToken({ playerId: 'bystander-cf', operatorId: 'test-op' });
    const client1 = await connectClient(ctx.url, token1);
    const client2 = await connectClient(ctx.url, token2);
    await delay(50);

    engine.publishCreditFailed({
      playerId: 'target-cf', betId: 'b-cf', roundId: 'r-cf',
      payoutCents: 1000, reason: 'TIMEOUT',
    });

    const cf = await client1.waitForMessage('credit_failed', 3000);
    expect(cf.reason).toBe('TIMEOUT');
    expect(cf.payoutCents).toBe(1000);

    // Bystander should NOT receive credit_failed
    await delay(300);
    const bystander = client2.messages.find((m) => m.type === 'credit_failed');
    expect(bystander).toBeUndefined();

    client1.close();
    client2.close();
    await delay(50);
  });

  it('bet_lost is broadcast to all connected clients', async () => {
    const token1 = await ctx.auth.signToken({ playerId: 'lost-p1', operatorId: 'test-op' });
    const token2 = await ctx.auth.signToken({ playerId: 'lost-p2', operatorId: 'test-op' });
    const client1 = await connectClient(ctx.url, token1);
    const client2 = await connectClient(ctx.url, token2);
    await delay(50);

    engine.publishBetLost({
      betId: 'bet-lost-1', playerId: 'lost-p1', roundId: 'lost-round',
      amountCents: 300, status: 'LOST', crashPoint: 1.2,
    });

    const lost1 = await client1.waitForMessage('bet_lost', 3000);
    const lost2 = await client2.waitForMessage('bet_lost', 3000);
    expect(lost1.crashPoint).toBe(1.2);
    expect(lost2.crashPoint).toBe(1.2);

    client1.close();
    client2.close();
    await delay(50);
  });
});
