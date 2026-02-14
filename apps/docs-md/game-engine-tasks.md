# Game Engine Architecture — Development Phases & Tasks

## Context

The [GAME-ENGINE-ARCHITECTURE.md](../../GAME-ENGINE-ARCHITECTURE.md) specifies a clean architecture for the crash game engine with three layers: **domain** (pure TypeScript), **application** (use cases + ports), and **infrastructure** (NestJS wiring). It lists 4 high-level implementation phases and ~30 files to create, but lacks granular tasks with dependencies and acceptance criteria. This plan expands it into 46 actionable tasks across 5 phases, aligned with Engineer 2's scope in [dev-plan.md](dev-plan.md).

The `apps/game-engine/` directory does not exist yet. The monorepo (pnpm + Turborepo) is scaffolded, and `packages/platform-api/` has a NestJS skeleton to reference.

---

## Dependency Graph (Critical Path)

```
P0 Scaffold ─→ P1 Domain Entities ─→ P2 Use Cases + Ports ─→ P3 NestJS Wiring ─→ P4 Integration Tests
                    │                        │                       │
              3 parallel tracks        ports parallel,          infra parallel,
              (engine/rng/betting)     then use cases           converge at AppModule
```

---

## Phase 0: Project Scaffolding

| ID | Task | Files | Acceptance Criteria | Deps | Size |
|----|------|-------|-------------------|------|------|
| P0.1 | Initialize `apps/game-engine/` | `package.json`, `tsconfig.json`, `nest-cli.json`, `.env.example`, all `src/` subdirectory stubs, `test/` dirs | `bun install` succeeds; dir structure matches architecture doc (lines 62-148); `turbo build` includes game-engine | — | S |
| P0.2 | Configure TypeScript strict + path aliases | `tsconfig.json`, `tsconfig.build.json` | `strict: true`; path aliases `@engine/`, `@betting/`, `@rng/`, `@shared/` resolve; `tsc --noEmit` passes | P0.1 | S |
| P0.3 | Configure test runner | `vitest.config.ts` or bun test config | `bun test test/domain/` runs independently of NestJS; coverage reporting works | P0.1 | S |

---

## Phase 1: Shared Kernel + Domain Entities

**Rule: ZERO framework imports. Pure TypeScript only. Tests written alongside code.**

Three parallel tracks after P1.2:

```
Track A (Engine):  P1.1 → P1.3 → P1.4 → P1.11 → P1.12 → P1.13
Track B (RNG):     P1.5 → P1.6 → P1.7
Track C (Betting): P1.8 → P1.9 → P1.10
All converge → P1.14
```

| ID | Task | Files | Acceptance Criteria | Deps | Size |
|----|------|-------|-------------------|------|------|
| P1.1 | `Money` value object (integer cents) | `src/shared/kernel/Money.ts`, `test/domain/Money.spec.ts` | `fromCents`, `fromDollars`, `zero` factories; `add`, `subtract`, `multiplyByMultiplier` (floor); rejects negative/NaN/Infinity/non-integer; zero npm imports | P0.3, P1.2 | S |
| P1.2 | `DomainError` base + subclasses | `src/shared/kernel/DomainError.ts` | Extends `Error`; subclasses: `InvalidMoneyError`, `InvalidStateTransition`, `BetNotActiveError`, `InvalidCrashPointError`, `InvalidSeedError` | P0.1 | S |
| P1.3 | `CrashPoint` value object | `src/engine/domain/CrashPoint.ts` | Wraps number >= 1.00; `CrashPoint.of(0.5)` throws; `.toDisplay()` returns 2dp string | P1.2 | S |
| P1.4 | `Multiplier` value object + curve calc | `src/engine/domain/Multiplier.ts`, `test/domain/Multiplier.spec.ts` | `Multiplier.at(0) === 1.0`; deterministic curve from elapsed ms; rate parameterizable from GameConfig | P1.2 | M |
| P1.5 | `SeedPair` value object | `src/rng/domain/SeedPair.ts` | Validates server seed (64-char hex) + client seed (non-empty); immutable | P1.2 | S |
| P1.6 | `ProvablyFair` (GLI-isolable RNG) | `src/rng/domain/ProvablyFair.ts`, `test/domain/ProvablyFair.spec.ts` | `generateServerSeed`, `hashServerSeed`, `calculateCrashPoint`, `verify`; SHA-512 + HMAC; only imports Node `crypto`; 4% house edge ≈ 4% instant crashes; deterministic with known test vectors | P1.3, P1.5 | L |
| P1.7 | `SeedChain` (seed rotation) | `src/rng/domain/SeedChain.ts` | Hash chain: `seed[n-1] = hash(seed[n])`; `next()` returns in reverse order; verifiable | P1.6 | M |
| P1.8 | `BetStatus` enum | `src/betting/domain/BetStatus.ts` | `PENDING`, `ACTIVE`, `WON`, `LOST`, `CANCELLED` | P0.1 | S |
| P1.9 | `Bet` rich entity | `src/betting/domain/Bet.ts`, `test/domain/Bet.spec.ts` | `activate()`, `cashout(multiplier): Money`, `lose()`, `shouldAutoCashout()`; state transitions enforced; payout uses `Money.multiplyByMultiplier` (floor) | P1.1, P1.2, P1.8 | M |
| P1.10 | `BetCollection` aggregate | `src/betting/domain/BetCollection.ts` | `add`, `getActive`, `settleAll`, `getAutoCashouts(multiplier)`; rejects duplicate IDs | P1.9 | M |
| P1.11 | `RoundState` enum + transitions | `src/engine/domain/RoundState.ts` | `WAITING → BETTING → RUNNING → CRASHED`; `canTransition(from, to)` pure function | P0.1 | S |
| P1.12 | `GameConfig` interface | `src/engine/domain/GameConfig.ts` | Plain TS interface: `houseEdgePercent`, `minBetCents`, `maxBetCents`, `bettingWindowMs`, `tickIntervalMs`; no Zod, no defaults | P0.1 | S |
| P1.13 | `Round` rich entity (state machine) | `src/engine/domain/Round.ts`, `test/domain/Round.spec.ts` | `openBetting()`, `startFlying()`, `tick(multiplier): boolean`, `addBet()`, `cashout()`; state guards; `tick()` calls `settleAll()` on crash | P1.3, P1.4, P1.10, P1.11 | L |
| P1.14 | Comprehensive domain tests | All `test/domain/*.spec.ts` | `bun test test/domain/` passes; `grep -r "@Injectable\|nestjs" src/*/domain/` = 0 matches; >90% coverage; edge cases: instant crash, boundary bets, max amounts | P1.1–P1.13 | M |

---

## Phase 2: Application Layer — Use Cases + Ports

**Rule: No NestJS imports. No infrastructure imports. Plain classes with constructor-injected ports.**

```
Parallel:  P2.1–P2.5, P2.9 (all ports + DTOs)
Then:      P2.6 ‖ P2.7 ‖ P2.10 (use cases in parallel)
Then:      P2.8 (RunGameLoopUseCase — depends on all above)
Finally:   P2.11 (comprehensive tests)
```

| ID | Task | Files | Acceptance Criteria | Deps | Size |
|----|------|-------|-------------------|------|------|
| P2.1 | `EventPublisher` port | `src/engine/application/ports/EventPublisher.ts` | Interface with 8 methods (`roundNew`, `roundCrashed`, `tick`, `betPlaced`, etc.); `BetSnapshot` type defined; zero framework imports | P1.1, P1.8 | S |
| P2.2 | `EventSubscriber` port | `src/engine/application/ports/EventSubscriber.ts` | `onPlaceBet(handler)`, `onCashout(handler)` | P2.5 | S |
| P2.3 | `TickScheduler` port | `src/engine/application/ports/TickScheduler.ts` | `start(callback: (elapsedMs) => void)`, `stop()` | P0.1 | S |
| P2.4 | `BetStore` port | `src/betting/application/ports/BetStore.ts` | `add`, `getById`, `getByRound`, `getActiveByRound` | P1.9 | S |
| P2.5 | Command + Result DTOs | `src/betting/application/commands/PlaceBetCommand.ts`, `PlaceBetResult.ts`, `CashoutCommand.ts`, `CashoutResult.ts` | Discriminated unions for results (`{ success: true, betId } | { success: false, error }`); plain data | P0.1 | S |
| P2.6 | `PlaceBetUseCase` | `src/betting/application/PlaceBetUseCase.ts`, `test/application/PlaceBetUseCase.spec.ts` | Validates min/max bet; creates `Bet`; stores via `BetStore`; returns result; tests use mocks | P1.1, P1.9, P1.12, P2.4, P2.5 | M |
| P2.7 | `CashoutUseCase` | `src/betting/application/CashoutUseCase.ts`, `test/application/CashoutUseCase.spec.ts` | Retrieves bet; validates ownership; calls `bet.cashout(multiplier)`; returns payout | P1.9, P2.4, P2.5 | M |
| P2.8 | `RunGameLoopUseCase` (orchestrator) | `src/engine/application/RunGameLoopUseCase.ts` | `start()`/`stop()`; manages round lifecycle; **tick order is synchronous**: (1) drain cashout queue → (2) process cashouts → (3) calc multiplier → (4) auto-cashouts → (5) crash check → (6) settle → (7) emit events; no `await` between steps within a tick | P1.4, P1.6, P1.12, P1.13, P2.1–P2.3, P2.6, P2.7 | L |
| P2.9 | `WalletGateway` port | `src/betting/application/ports/WalletGateway.ts` | `debit`, `credit`, `getBalance`; `WalletResult` union type with `INSUFFICIENT_FUNDS`, `PLAYER_BLOCKED`, `TIMEOUT` | P1.1 | S |
| P2.10 | `GetRoundStateUseCase` | `src/engine/application/GetRoundStateUseCase.ts` | Returns current round snapshot (for client reconnect); no infra deps | P1.11, P1.13 | S |
| P2.11 | Comprehensive use case tests | `test/application/RunGameLoopUseCase.spec.ts` + finalize others | All pass; mock ports verify interaction; tick ordering validated; race condition scenario tested; `grep -r "nestjs" src/*/application/` = 0 | P2.6–P2.10 | L |

---

## Phase 3: Infrastructure — NestJS Wiring

**Rule: Only place for `@Injectable`, `@Module`, `@Inject`. Domain classes wired via `useFactory`.**

```
Parallel tracks:
  A: P3.5 → P3.2 → P3.3 → P3.4  (messaging)
  B: P3.1                         (config)
  C: P3.6                         (bet store)
  D: P3.7                         (tick scheduler)
  E: P3.8 → P3.10                 (wallet + betting module)
  F: P3.9, P3.11                  (engine + rng modules)
Converge → P3.12 → P3.13
```

| ID | Task | Files | Acceptance Criteria | Deps | Size |
|----|------|-------|-------------------|------|------|
| P3.1 | Config module + Zod schema | `src/config/config.module.ts`, `game-config.schema.ts`, `env-config.provider.ts` | Validates env vars via Zod; maps to `GameConfig` interface; missing var = clear error at startup; exports `GAME_CONFIG` token | P1.12 | M |
| P3.2 | `NatsEventPublisher` | `src/messaging/NatsEventPublisher.ts` | `@Injectable`; implements `EventPublisher`; publishes JSON to NATS topics; logs on failure, doesn't crash engine | P2.1, P3.5 | M |
| P3.3 | `NatsEventSubscriber` | `src/messaging/NatsEventSubscriber.ts` | `@Injectable`; implements `EventSubscriber`; subscribes to command topics; deserializes to DTOs; queues commands | P2.2, P2.5, P3.5 | M |
| P3.4 | `MessagingModule` | `src/messaging/messaging.module.ts` | `@Module`; NATS connection from env; reconnection logic; exports publisher + subscriber | P3.2, P3.3 | M |
| P3.5 | NATS topic constants | `src/messaging/topics.ts` | All topics as constants; operator-prefixable pattern (`game.${opId}.round.new`) | P0.1 | S |
| P3.6 | `InMemoryBetStore` | `src/betting/infrastructure/InMemoryBetStore.ts` | `@Injectable`; implements `BetStore`; `Map<string, Bet>` storage | P2.4 | S |
| P3.7 | `SetIntervalTickScheduler` | `src/engine/infrastructure/SetIntervalTickScheduler.ts` | `@Injectable`; implements `TickScheduler`; high-res timer (`performance.now()`); configurable interval | P2.3 | S |
| P3.8 | Wallet adapter stubs | `src/betting/infrastructure/wallet-adapters/SoftSwiss*.ts`, `EveryMatrix*.ts`, `DirectCrypto*.ts` | `SoftSwissWalletAdapter` with stubbed HTTP; others return `{ success: true }`; all `@Injectable` | P2.9 | M |
| P3.9 | `engine.module.ts` | `src/engine/infrastructure/engine.module.ts` | `@Module`; provides `RunGameLoopUseCase` + `GetRoundStateUseCase` via `useFactory` | P2.8, P2.10 | S |
| P3.10 | `betting.module.ts` | `src/betting/infrastructure/betting.module.ts` | `@Module`; provides use cases via `useFactory`; maps `BetStore` + `WalletGateway` tokens | P2.6, P2.7, P3.6, P3.8 | S |
| P3.11 | `rng.module.ts` | `src/rng/infrastructure/rng.module.ts` | `@Module`; exports `ProvablyFair` + `SeedChain` | P1.6, P1.7 | S |
| P3.12 | `app.module.ts` (composition root) | `src/app.module.ts` | Imports all modules; maps port tokens → infra implementations; `onApplicationBootstrap` starts game loop | P3.1, P3.4, P3.9, P3.10, P3.11 | M |
| P3.13 | `main.ts` bootstrap | `src/main.ts` | `NestFactory.create(AppModule)`; logs operator ID; graceful shutdown (SIGTERM → stop loop → close NATS); no HTTP listener | P3.12 | S |

---

## Phase 4: Integration Testing & Verification

| ID | Task | Files | Acceptance Criteria | Deps | Size |
|----|------|-------|-------------------|------|------|
| P4.1 | Full round lifecycle E2E | `test/integration/game-loop.e2e.spec.ts` | NestJS test module; bet → fly → cashout → crash → settle; payout math correct; runs < 5s | All P3 | L |
| P4.2 | NATS message flow test | `test/integration/nats-flow.e2e.spec.ts` | Real/embedded NATS; send `cmd.place-bet` → receive `bet.placed` event; payload schemas match | P4.1 | M |
| P4.3 | Tick loop performance | `test/integration/tick-performance.spec.ts` | 1000 active bets + 100 auto-cashouts per tick < 16ms; no memory leak over 1000 rounds | P4.1 | M |
| P4.4 | Domain purity verification | CI script or test | `grep -r "@Injectable\|@Inject\|@Module\|nestjs" src/*/domain/ src/*/application/ src/shared/` = 0 matches; runs in CI | All source | S |
| P4.5 | Cashout race condition test | `test/integration/cashout-race.spec.ts` | Cashout queued before crash tick → succeeds; cashout after crash → fails; no payout > `amount * crashPoint` | P4.1 | M |

---

## Sprint Plan (Recommended Execution Order)

| Sprint | Days | Tasks | Milestone |
|--------|------|-------|-----------|
| **1** | 1-2 | P0.1, P0.2, P0.3, P1.2, P1.1, P1.8, P1.11, P1.12 | Runnable project + shared kernel |
| **2** | 3-5 | P1.3, P1.4, P1.5, P1.6, P1.9 | Core domain entities + RNG |
| **3** | 6-7 | P1.7, P1.10, P1.13, P1.14 | Domain layer complete |
| **4** | 8-9 | P2.1–P2.5, P2.9, P2.10 | All ports + DTOs defined |
| **5** | 10-12 | P2.6, P2.7, P2.8, P2.11 | Application layer complete |
| **6** | 13-15 | P3.1–P3.8 | All infra implementations |
| **7** | 16-17 | P3.9–P3.13, P4.4 | Engine boots and runs |
| **8** | 18-20 | P4.1–P4.3, P4.5 | Integration verified |

**Total: 46 tasks, ~17-23 working days**

---

## Verification (End-to-End)

```bash
# Domain tests (pure, no NestJS, no Docker)
bun test test/domain/

# Use case tests (mocked ports)
bun test test/application/

# Integration tests (requires Docker NATS)
docker compose -f infrastructure/docker/docker-compose.yml up -d nats
bun test test/integration/

# Start the engine
bun run start
# Expected: [GameEngine] Round abc-123 started (crash @ 2.45x)

# Verify domain purity
grep -r "@Injectable\|@Inject\|@Module\|nestjs" src/*/domain/ src/*/application/
# Expected: no matches
```

---

## Alignment with dev-plan.md

| dev-plan.md Section | Maps to |
|---------------------|---------|
| Phase 1.1 (Scaffold game-engine) | P0.1–P0.3 |
| Phase 1.4 (Shared Contracts) | P2.1, P2.5 (port + DTO contracts) |
| Phase 2.1 (Bet Placement) | P1.9, P2.6 |
| Phase 2.2 (Round State Machine) | P1.11, P1.13, P2.8 |
| Phase 2.3 (Provably Fair RNG) | P1.5, P1.6, P1.7 |
| Phase 2.5 (Cashout) | P2.7, P4.5 |
| Phase 3 (NATS integration) | P3.2–P3.4, P4.2 |
| Sync Point 1 (Protobuf lock) | P2.1 + P2.5 complete |
| Sync Point 2 (WS format) | P3.2 + P3.5 complete |
