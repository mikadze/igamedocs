/**
 * NATS topic constants for the crash game engine.
 *
 * Topics are operator-siloed: each engine instance publishes to
 * topics prefixed with `game.{operatorId}.*`. The prefix is
 * resolved once at boot via {@link createTopics}.
 */

export interface GameTopics {
  readonly ROUND_NEW: string;
  readonly ROUND_BETTING: string;
  readonly ROUND_STARTED: string;
  readonly ROUND_CRASHED: string;
  readonly TICK: string;
  readonly BET_PLACED: string;
  readonly BET_WON: string;
  readonly BET_LOST: string;
  readonly BET_REJECTED: string;
  readonly CREDIT_FAILED: string;
  readonly CMD_PLACE_BET: string;
  readonly CMD_CASHOUT: string;
}

/**
 * Creates operator-scoped NATS topic constants.
 * Call once at boot with the validated operator ID from {@link RealtimeConfig}.
 *
 * @param operatorId  Pre-validated lowercase slug from the environment.
 *
 * @example
 * const TOPICS = createTopics('operator-a');
 * // TOPICS.ROUND_NEW === 'game.operator-a.round.new'
 */
export function createTopics(operatorId: string): GameTopics {
  const prefix = `game.${operatorId}`;

  return Object.freeze({
    ROUND_NEW: `${prefix}.round.new`,
    ROUND_BETTING: `${prefix}.round.betting`,
    ROUND_STARTED: `${prefix}.round.started`,
    ROUND_CRASHED: `${prefix}.round.crashed`,
    TICK: `${prefix}.tick`,
    BET_PLACED: `${prefix}.bet.placed`,
    BET_WON: `${prefix}.bet.won`,
    BET_LOST: `${prefix}.bet.lost`,
    BET_REJECTED: `${prefix}.bet.rejected`,
    CREDIT_FAILED: `${prefix}.credit.failed`,
    CMD_PLACE_BET: `${prefix}.cmd.place-bet`,
    CMD_CASHOUT: `${prefix}.cmd.cashout`,
  });
}
