# Game Engine Architecture Plan (Clean Architecture + NestJS)

## Context

The current plan wraps all game logic in NestJS `@Injectable()` services, coupling domain rules (RNG, betting, state machine) to the framework. This violates Clean Architecture's core dependency rule and makes the most critical code (provably fair RNG, bet validation) untestable without framework bootstrapping. The tech-analysis docs require **GLI-certifiable isolated RNG**, **<100ms cash-out validation**, and an **immutable audit trail** — all of which demand a pure domain layer that can be audited, tested, and certified independently of NestJS.

This revised plan separates concerns into proper layers: **domain** (pure TypeScript, zero imports), **application** (use cases with ports), and **infrastructure** (NestJS modules, NATS, Redis). NestJS becomes a thin shell wiring everything together at the composition root.

### Key Architectural Decisions

- **Tenancy**: Operator-siloed game engine + shared social/platform layer (see [Tenancy & Scaling](#tenancy--scaling-model))
- **Scaling**: Vertical-first for the engine tick loop; horizontal for WebSocket tier and platform API
- **Money**: Integer cents via `Money` value object — no Big.js (see [Number Precision](#number-precision--money-value-object))
- **Interfaces**: Ports at application boundaries only — no `IBet`/`IRound` interface pollution
- **Monorepo**: Deployable services in `apps/`, shared libraries in `packages/`

---

## Clean Architecture Audit of Previous Plan

| Rule | Severity | Violation | Fix |
|------|----------|-----------|-----|
| `dep-inward-only` | CRITICAL | `GameEngineService` imports `NatsService` directly | Depend on `EventPublisher` port defined in application layer |
| `dep-no-framework-imports` | CRITICAL | `@Injectable()` on all domain services (RNG, State Machine) | Domain/application classes are plain TypeScript; NestJS decorators only in infrastructure |
| `entity-pure-business-rules` | CRITICAL | No rich domain entities; `Round`, `Bet` are just interfaces | Create `Round`, `Bet`, `CrashPoint` as domain classes with encapsulated rules |
| `frame-domain-purity` | HIGH | Types co-located with NestJS services | Separate `domain/` sublayer with zero framework deps |
| `usecase-input-output-ports` | HIGH | No input/output ports; NATS messages hit services directly | Define `PlaceBetCommand`, `CashoutCommand` with explicit result types |
| `comp-screaming-architecture` | HIGH | Flat `.service.ts` files per module | Add `domain/`, `application/`, `infrastructure/` sublayers per module |
| `adapt-gateway-abstraction` | MEDIUM | NATS directly used in engine logic | Abstract behind `EventPublisher` / `EventSubscriber` interfaces |
| `frame-di-container-edge` | MEDIUM | `@Inject('GAME_CONFIG')` scattered in services | Config injected at composition root; plain constructor params in domain |

---

## Monorepo Structure

Deployable services live in `apps/`; shared libraries in `packages/`. Per `comp-screaming-architecture`, the top-level structure should reveal the deployment topology, not blur it.

```
igame-monorepo/
├── apps/
│   ├── game-engine/           ← Bun.js crash engine (deploys as container per operator)
│   ├── realtime-server/       ← uWebSockets + NATS (deploys as container)
│   ├── platform-api/          ← NestJS gateway (deploys as container)
│   ├── frontend/              ← React 19 + Vite (deploys to CDN)
│   └── docs-hosted/           ← static HTML (deploys to Vercel)
├── packages/
│   └── shared/                ← Protobuf schemas, TypeScript types, shared kernel
├── infrastructure/
│   ├── docker/
│   ├── k8s/
│   └── terraform/
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Game Engine Internal Architecture

```
apps/game-engine/
├── src/
│   ├── main.ts                              # NestJS bootstrap (composition root)
│   ├── app.module.ts                        # Root module (wiring only)
│   │
│   ├── engine/                              # ── CORE DOMAIN MODULE ──
│   │   ├── domain/
│   │   │   ├── Round.ts                     # Rich entity: state machine + rules
│   │   │   ├── RoundState.ts                # Enum + transition rules
│   │   │   ├── CrashPoint.ts                # Value object
│   │   │   ├── Multiplier.ts                # Value object with curve calc
│   │   │   └── GameConfig.ts                # Domain config interface (no Zod)
│   │   ├── application/
│   │   │   ├── ports/
│   │   │   │   ├── EventPublisher.ts        # Output port (interface)
│   │   │   │   ├── EventSubscriber.ts       # Input port (interface)
│   │   │   │   └── TickScheduler.ts         # Output port (interface)
│   │   │   ├── RunGameLoopUseCase.ts        # Orchestrates round lifecycle
│   │   │   └── GetRoundStateUseCase.ts
│   │   └── infrastructure/
│   │       ├── engine.module.ts             # NestJS wiring
│   │       └── SetIntervalTickScheduler.ts  # Implements TickScheduler
│   │
│   ├── rng/                                 # ── RNG MODULE (GLI-isolable) ──
│   │   ├── domain/
│   │   │   ├── ProvablyFair.ts              # Pure: SHA-512, crash calc
│   │   │   ├── SeedPair.ts                  # Value object
│   │   │   └── SeedChain.ts                 # Seed rotation logic
│   │   └── infrastructure/
│   │       └── rng.module.ts                # NestJS wiring
│   │
│   ├── betting/                             # ── BETTING MODULE ──
│   │   ├── domain/
│   │   │   ├── Bet.ts                       # Rich entity: validate, cashout, lose
│   │   │   ├── BetStatus.ts                 # Enum
│   │   │   └── BetCollection.ts             # Aggregate: round's bets
│   │   ├── application/
│   │   │   ├── ports/
│   │   │   │   ├── BetStore.ts              # Output port (interface)
│   │   │   │   └── WalletGateway.ts         # Output port (operator wallet)
│   │   │   ├── PlaceBetUseCase.ts
│   │   │   ├── CashoutUseCase.ts
│   │   │   └── commands/
│   │   │       ├── PlaceBetCommand.ts       # Input DTO
│   │   │       ├── PlaceBetResult.ts        # Output DTO
│   │   │       ├── CashoutCommand.ts
│   │   │       └── CashoutResult.ts
│   │   └── infrastructure/
│   │       ├── betting.module.ts            # NestJS wiring
│   │       ├── InMemoryBetStore.ts          # Implements BetStore port
│   │       └── wallet-adapters/             # Operator wallet implementations
│   │           ├── SoftSwissWalletAdapter.ts
│   │           ├── EveryMatrixWalletAdapter.ts
│   │           └── DirectCryptoWalletAdapter.ts
│   │
│   ├── messaging/                           # ── INFRASTRUCTURE ONLY ──
│   │   ├── messaging.module.ts
│   │   ├── NatsEventPublisher.ts            # Implements engine's EventPublisher
│   │   ├── NatsEventSubscriber.ts           # Implements engine's EventSubscriber
│   │   └── topics.ts
│   │
│   ├── config/                              # ── INFRASTRUCTURE ONLY ──
│   │   ├── config.module.ts
│   │   ├── game-config.schema.ts            # Zod schema (infra concern)
│   │   └── env-config.provider.ts           # Maps env → domain GameConfig
│   │
│   └── shared/
│       └── kernel/
│           ├── Money.ts                     # Value object (integer cents)
│           └── DomainError.ts               # Base error class
│
├── test/
│   ├── domain/                              # Pure unit tests (no NestJS)
│   │   ├── Round.spec.ts
│   │   ├── Bet.spec.ts
│   │   ├── Money.spec.ts
│   │   ├── ProvablyFair.spec.ts
│   │   └── Multiplier.spec.ts
│   ├── application/                         # Use case tests (mock ports)
│   │   ├── PlaceBetUseCase.spec.ts
│   │   └── CashoutUseCase.spec.ts
│   └── integration/                         # Full NestJS bootstrap
│       └── game-loop.e2e.spec.ts
├── package.json
├── tsconfig.json
├── nest-cli.json
└── .env.example
```

---

## Layer Rules

| Layer | Can Import | Cannot Import | NestJS Decorators |
|-------|------------|---------------|-------------------|
| **domain/** | Only `shared/kernel`, other domain files | application, infrastructure, any npm package | NONE |
| **application/** | domain, shared/kernel | infrastructure, NestJS, nats, ioredis | NONE |
| **infrastructure/** | domain, application, NestJS, npm packages | — | YES (`@Module`, `@Injectable`, `@Inject`) |

---

## Domain Entities (Pure TypeScript)

### Round (engine/domain/Round.ts)

```typescript
// ZERO imports from NestJS, NATS, or any framework
export class Round {
  private state: RoundState;
  private readonly crashPoint: CrashPoint;
  private currentMultiplier: number = 1.0;
  private bets: BetCollection;

  constructor(id: string, crashPoint: CrashPoint, hashedSeed: string) { ... }

  openBetting(): void {
    if (this.state !== RoundState.WAITING) throw new InvalidStateTransition();
    this.state = RoundState.BETTING;
  }

  startFlying(): void {
    if (this.state !== RoundState.BETTING) throw new InvalidStateTransition();
    this.state = RoundState.RUNNING;
  }

  tick(multiplier: number): boolean /* crashed */ {
    this.currentMultiplier = multiplier;
    if (multiplier >= this.crashPoint.value) {
      this.state = RoundState.CRASHED;
      this.bets.settleAll();  // Mark remaining active bets as lost
      return true;
    }
    return false;
  }

  addBet(bet: Bet): void { ... }        // Delegates to BetCollection
  cashout(betId: string): Bet { ... }    // Validates state, delegates to Bet
}
```

### Bet (betting/domain/Bet.ts)

```typescript
export class Bet {
  constructor(id, playerId, roundId, amount: Money, autoCashout?) { ... }

  activate(): void { ... }

  cashout(multiplier: number): Money /* payout */ {
    if (this.status !== BetStatus.ACTIVE) throw new BetNotActiveError();
    this.status = BetStatus.WON;
    this.cashoutMultiplier = multiplier;
    this.payout = this.amount.multiplyByMultiplier(multiplier); // integer cents, floor rounding
    return this.payout;
  }

  lose(): void { ... }

  shouldAutoCashout(currentMultiplier: number): boolean {
    return this.autoCashout !== undefined && currentMultiplier >= this.autoCashout;
  }
}
```

### ProvablyFair (rng/domain/ProvablyFair.ts)

```typescript
// GLI-isolable: ZERO external dependencies, pure crypto functions
import { createHmac, createHash, randomBytes } from 'crypto';

export class ProvablyFair {
  static generateServerSeed(): string { ... }
  static hashServerSeed(seed: string): string { ... }
  static calculateCrashPoint(serverSeed, clientSeed, nonce, houseEdgePercent): CrashPoint { ... }
  static verify(serverSeed, clientSeed, nonce, claimedPoint, houseEdgePercent): boolean { ... }
}
```

---

## Application Layer (Use Cases + Ports)

### Ports (interfaces owned by the application layer)

Interfaces exist ONLY at application boundaries where implementations vary. Do not create `IBet`, `IRound`, `IProvablyFair` — that is interface pollution. Domain entities, value objects, and use cases are concrete classes.

```typescript
// engine/application/ports/EventPublisher.ts
export interface EventPublisher {
  roundNew(roundId: string, hashedSeed: string): Promise<void>;
  roundBetting(roundId: string, endsAt: number): Promise<void>;
  roundStarted(roundId: string): Promise<void>;
  roundCrashed(roundId: string, crashPoint: number, serverSeed: string): Promise<void>;
  tick(roundId: string, multiplier: number, elapsed: number): Promise<void>;
  betPlaced(bet: BetSnapshot): Promise<void>;
  betWon(bet: BetSnapshot): Promise<void>;
  betLost(bet: BetSnapshot, crashPoint: number): Promise<void>;
}

// engine/application/ports/EventSubscriber.ts
export interface EventSubscriber {
  onPlaceBet(handler: (cmd: PlaceBetCommand) => void): void;
  onCashout(handler: (cmd: CashoutCommand) => void): void;
}

// engine/application/ports/TickScheduler.ts
export interface TickScheduler {
  start(callback: (elapsedMs: number) => void): void;
  stop(): void;
}

// betting/application/ports/WalletGateway.ts
// Anti-corruption layer for operator wallet APIs (GCI/RGS protocol)
export interface WalletGateway {
  debit(playerId: string, amount: Money, roundId: string, betId: string): Promise<WalletResult>;
  credit(playerId: string, amount: Money, roundId: string, betId: string): Promise<WalletResult>;
  getBalance(playerId: string): Promise<Money>;
}

export type WalletResult =
  | { success: true; transactionId: string; newBalance: Money }
  | { success: false; error: 'INSUFFICIENT_FUNDS' | 'PLAYER_BLOCKED' | 'TIMEOUT' };
```

### PlaceBetUseCase

```typescript
// betting/application/PlaceBetUseCase.ts — no @Injectable, no NestJS
export class PlaceBetUseCase {
  constructor(
    private readonly config: GameConfig,   // plain interface, not ConfigService
    private readonly betStore: BetStore,   // port interface
  ) {}

  execute(command: PlaceBetCommand): PlaceBetResult {
    if (command.amount < this.config.minBetAmount) { ... }
    if (command.amount > this.config.maxBetAmount) { ... }

    const bet = new Bet(crypto.randomUUID(), command.playerId, command.roundId, command.amount, command.autoCashout);
    this.betStore.add(bet);
    return { success: true, betId: bet.id };
  }
}
```

---

## Infrastructure Layer (NestJS lives HERE)

### Composition Root (app.module.ts)

```typescript
@Module({
  imports: [ConfigModule, MessagingModule],
  providers: [
    // Wire domain ports → infrastructure implementations
    { provide: 'EventPublisher',  useClass: NatsEventPublisher },
    { provide: 'EventSubscriber', useClass: NatsEventSubscriber },
    { provide: 'TickScheduler',   useClass: SetIntervalTickScheduler },
    { provide: 'BetStore',        useClass: InMemoryBetStore },
    { provide: 'WalletGateway',   useClass: SoftSwissWalletAdapter }, // per-operator

    // Use cases (plain classes, wired via factory)
    {
      provide: PlaceBetUseCase,
      useFactory: (config: GameConfig, store: BetStore, wallet: WalletGateway) =>
        new PlaceBetUseCase(config, store, wallet),
      inject: ['GAME_CONFIG', 'BetStore', 'WalletGateway'],
    },
    {
      provide: CashoutUseCase,
      useFactory: (store: BetStore, wallet: WalletGateway) =>
        new CashoutUseCase(store, wallet),
      inject: ['BetStore', 'WalletGateway'],
    },
    {
      provide: RunGameLoopUseCase,
      useFactory: (publisher, subscriber, scheduler, placeBet, cashout, config) =>
        new RunGameLoopUseCase(publisher, subscriber, scheduler, placeBet, cashout, config),
      inject: ['EventPublisher', 'EventSubscriber', 'TickScheduler', PlaceBetUseCase, CashoutUseCase, 'GAME_CONFIG'],
    },
  ],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(private readonly gameLoop: RunGameLoopUseCase) {}
  async onApplicationBootstrap() { await this.gameLoop.start(); }
}
```

### NatsEventPublisher (messaging/NatsEventPublisher.ts)

```typescript
@Injectable()
export class NatsEventPublisher implements EventPublisher {
  constructor(private readonly nats: NatsConnection) {}

  async roundCrashed(roundId, crashPoint, serverSeed): Promise<void> {
    await this.nats.publish(TOPICS.ROUND_CRASHED, JSON.stringify({ roundId, crashPoint, serverSeed }));
  }
  // ... other methods
}
```

---

## Number Precision — Money Value Object

All monetary values use **integer smallest-unit** (cents, satoshis) — no `Big.js` or floating-point for money.

JavaScript `number` is IEEE 754 double-precision float (`0.1 + 0.2 = 0.30000000000000004`). In a gambling platform, these rounding errors compound across millions of transactions, cause balance drift, fail GLI audits, and create exploitable edge cases.

### Money (shared/kernel/Money.ts)

```typescript
// ZERO dependencies — domain layer
export class Money {
  private constructor(private readonly cents: number) {
    if (!Number.isInteger(cents)) throw new InvalidMoneyError('Must be integer cents');
    if (!Number.isFinite(cents)) throw new InvalidMoneyError('Must be finite');
    if (cents < 0) throw new InvalidMoneyError('Must be non-negative');
  }

  static fromCents(cents: number): Money { return new Money(cents); }
  static fromDollars(dollars: number): Money { return new Money(Math.round(dollars * 100)); }
  static zero(): Money { return new Money(0); }

  add(other: Money): Money { return new Money(this.cents + other.cents); }
  subtract(other: Money): Money { return new Money(this.cents - other.cents); }

  // CRITICAL: Payout calculation — always round DOWN (house edge preserved)
  multiplyByMultiplier(multiplier: number): Money {
    return new Money(Math.floor(this.cents * multiplier));
  }

  isGreaterThan(other: Money): boolean { return this.cents > other.cents; }
  isZero(): boolean { return this.cents === 0; }
  toCents(): number { return this.cents; }
  toDisplay(): string { return (this.cents / 100).toFixed(2); }
  equals(other: Money): boolean { return this.cents === other.cents; }
}
```

### Why not Big.js

| Factor | Big.js | Integer Cents |
|--------|--------|---------------|
| Hot path performance | ~10-50x slower | Native integer ops |
| Domain purity | External npm dep in domain layer | Zero dependencies |
| GLI audit | Must also audit Big.js | Simple integer math, trivially auditable |
| Precision | Overkill (arbitrary) | Exact for 2 decimal places |
| Industry standard | Uncommon in fintech | Stripe, every payment processor |

### Number types across the system

| Value | Type | Notes |
|-------|------|-------|
| Bet amount, Balance, Payout | `Money` (integer cents) | Exact arithmetic |
| Multiplier | `number` (float) | Display value; `Money.multiplyByMultiplier()` floors result |
| Crash point | `CrashPoint` value object | Wraps `number`, displayed to 2dp |
| House edge | `number` (float) | Config value, used in RNG only |

For crypto (BTC = 8 decimals), use satoshis as the base unit. Parameterize with a `Currency` value object.

---

## Tenancy & Scaling Model

### B2B Integration Model

Aviatrix is a game provider. Operators embed the game via iFrame + wallet API (GCI/RGS):

```
Player → Operator's site → iFrame loads from Aviatrix CDN
                         → Auth token validated → Wallet balance fetched
                         → Bets/wins posted back via operator wallet API
```

Each operator has different wallet API variants, house edge, bet limits, currencies, and jurisdictional requirements.

### Operator-Siloed Engine + Shared Social Layer

**Not pure single-tenant. Not pure multi-tenant. A hybrid.**

```
┌─────────────────────────────────────────────────────────┐
│                   PER OPERATOR (siloed)                  │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Game Engine   │  │ Game Engine   │  │ Game Engine   │  │
│  │ (Operator A)  │  │ (Operator B)  │  │ (Operator C)  │  │
│  │ - Own rounds  │  │ - Own rounds  │  │ - Own rounds  │  │
│  │ - Own config  │  │ - Own config  │  │ - Own config  │  │
│  │ - Own wallet  │  │ - Own wallet  │  │ - Own wallet  │  │
│  │   adapter     │  │   adapter     │  │   adapter     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐  │
│  │ WS Server(s) │  │ WS Server(s) │  │ WS Server(s) │  │
│  │ (Operator A)  │  │ (Operator B)  │  │ (Operator C)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
│  DB: schema per operator    Audit: isolated per operator │
├─────────────────────────────────────────────────────────┤
│                SHARED (multi-tenant)                     │
│                                                         │
│  Platform API (stateless, routes by operator_id)         │
│  Social Services (Crews, Leaderboards, Profiles)         │
│  NATS Cluster (topic-prefixed: operator_a.round.*)       │
│  PostgreSQL Cluster (shared infra, isolated schemas)     │
│  Redis Cluster (key-prefixed: op_a:round:123)            │
└─────────────────────────────────────────────────────────┘
```

### Why siloed engine

| Concern | Siloed | Shared | Verdict |
|---------|--------|--------|---------|
| Performance isolation | Operator A spike doesn't affect B | Noisy neighbor | **Siloed** |
| Regulatory compliance | Trivially isolated audit trails | tenant_id everywhere | **Siloed** |
| Failure blast radius | One operator affected | ALL operators down | **Siloed** |
| Domain purity | No `operatorId` in entities | Pollutes every entity | **Siloed** (`entity-pure-business-rules`) |
| Infra cost | N × M pods | Shared pods | Shared |
| Onboarding speed | Spin up namespace | Add config row | Shared |

**The game engine is the hot path — it MUST be isolated.** Social and platform layers are warm/cold path — shared.

### Scaling strategy

| Layer | Strategy | Why |
|-------|----------|-----|
| **Game Engine** | **Vertical-first** | Tick loop is single-threaded JS/Bun. Faster CPU = faster ticks. More cores don't help. |
| **WebSocket tier** | **Horizontal** | NATS fan-out to N realtime-server instances per shard of connected players. |
| **Platform API** | **Horizontal** | Stateless NestJS behind load balancer. |
| **PostgreSQL** | **Vertical + read replicas** | Write-heavy game data needs fast disk; read replicas for analytics. |
| **NATS** | **Clustered** | Native clustering handles the message volume. |

### Why vertical-first for the engine

The tick loop at 50ms intervals is a real-time system:
1. **Single-threaded**: `Round.tick()` → process auto-cashouts → check crash → emit events must complete in < 16ms on one core
2. **Horizontal doesn't help**: Can't split one round's tick across machines — only helps if you need MORE concurrent rounds
3. **When to go horizontal within an operator**: Multiple game rooms (VIP, Standard, Tournament). Each room's round lifecycle runs on a separate engine instance. The `RoundStore` port enables this.

### Composition root per operator

```typescript
// main.ts boots with operator-specific env vars
// The domain layer knows NOTHING about tenancy

@Module({
  providers: [
    // Operator-specific wallet adapter (selected at boot)
    { provide: 'WalletGateway', useClass: SoftSwissWalletAdapter },

    // Operator-specific config
    { provide: 'GAME_CONFIG', useFactory: () => loadOperatorConfig(process.env.OPERATOR_ID) },

    // Everything else is the same across operators
    { provide: 'EventPublisher',  useClass: NatsEventPublisher },
    { provide: 'EventSubscriber', useClass: NatsEventSubscriber },
    { provide: 'TickScheduler',   useClass: SetIntervalTickScheduler },
    { provide: 'BetStore',        useClass: InMemoryBetStore },
  ],
})
export class AppModule { ... }
```

### Kubernetes deployment model

```yaml
# Per operator: a Helm release
# helm install operator-a aviatrix-engine -f values-operator-a.yaml
operator:
  id: "operator-a"
  name: "MegaCasino"
  walletAdapter: "softswiss"
  config:
    houseEdgePercent: 4
    minBetCents: 10
    maxBetCents: 100000
  resources:
    engine:
      cpu: "4"           # Vertical: beefy single instance
      memory: "4Gi"
    realtimeServer:
      replicas: 3        # Horizontal: multiple WS servers
```

Each operator = a K8s namespace with 1 engine pod (vertical) + N WS pods (horizontal) + shared access to NATS/PG/Redis cluster.

**Cost mitigations**: Game engine pod is tiny (pure logic + timer, ~2 vCPU). Shared infra (NATS, PG, Redis) is clustered, not duplicated. Small operators use smaller instances. Operators pay licensing fees covering their compute.

---

## Security Notes

### Atomic Cashout (Critical)

The cashout-vs-crash race is the #1 security risk. The `EventSubscriber` MUST queue cashout commands and process them at the start of the next tick, never mid-tick:

```
// RunGameLoopUseCase.tick() — synchronous, no await between steps:
// 1. Drain cashout command queue
// 2. Process each cashout (Bet.cashout())
// 3. Calculate multiplier
// 4. Process auto-cashouts
// 5. Check crash condition
// 6. If crashed: settleAll() remaining bets as lost
// 7. Emit events
```

JS single-threaded execution guarantees atomicity within a tick. The risk is cashout requests arriving via WebSocket *during* a tick — queuing prevents this.

### Input Validation

The `Money` value object rejects negative, NaN, Infinity, and non-integer values at construction. This eliminates an entire class of exploits at the domain boundary.

### CORS

`app.enableCors()` in platform-api must be restricted to operator-specific origins before production. Each operator's allowed origins are part of their configuration.

---

## Doc Requirements Alignment

| Requirement (from tech-analysis) | How This Architecture Addresses It |
|----------------------------------|------------------------------------|
| **GLI-certified isolated RNG** | `rng/domain/ProvablyFair.ts` has zero deps — can be extracted and audited standalone |
| **<100ms cash-out validation** | `Bet.cashout()` is a pure in-memory operation; no I/O in the hot path |
| **Immutable audit trail** | `EventPublisher` port enables event sourcing; swap NATS impl for append-only log |
| **Copy-Bet system (future)** | Add a new `EventSubscriber.onCopyBet()` port method — domain untouched |
| **Multi-mode support (future)** | Subclass or compose `Round` with mode-specific rules — domain stays pure |
| **10K+ concurrent players** | Pure domain logic is CPU-bound with no blocking I/O |
| **Provably Fair verification** | `ProvablyFair.verify()` is a static pure function callable from anywhere |
| **B2B operator wallet integration** | `WalletGateway` port with per-operator adapters (SoftSwiss, EveryMatrix, etc.) — anti-corruption layer |
| **Multi-operator isolation** | Operator-siloed engine instances; domain entities have zero tenancy awareness |
| **Operator-specific configuration** | `GameConfig` injected at composition root per operator; house edge, bet limits, currencies |
| **Floating-point money safety** | `Money` value object (integer cents) eliminates rounding errors; `Math.floor` preserves house edge |
| **Cashout race condition** | Atomic per-tick processing: cashout commands queued, drained synchronously at tick start |
| **Horizontal scaling (WS tier)** | NATS fan-out to N realtime-server instances per operator; engine stays vertical-first |

---

## Implementation Phases

### Phase 1: Shared Kernel + Domain Entities
1. Create `shared/kernel/` (Money, DomainError)
2. Create `rng/domain/` (ProvablyFair, SeedPair, SeedChain)
3. Create `engine/domain/` (Round, RoundState, CrashPoint, Multiplier, GameConfig interface)
4. Create `betting/domain/` (Bet, BetStatus, BetCollection)
5. Write pure domain unit tests (no NestJS needed)

### Phase 2: Application Layer (Use Cases + Ports)
1. Define output ports: EventPublisher, EventSubscriber, TickScheduler, BetStore
2. Define commands: PlaceBetCommand/Result, CashoutCommand/Result
3. Implement PlaceBetUseCase, CashoutUseCase
4. Implement RunGameLoopUseCase (orchestrates Round lifecycle)
5. Write use case tests with mock ports

### Phase 3: Infrastructure (NestJS Wiring)
1. Create config.module.ts + Zod schema → maps to domain GameConfig
2. Create messaging.module.ts + NatsEventPublisher/Subscriber
3. Create InMemoryBetStore, SetIntervalTickScheduler
4. Create app.module.ts composition root with factory providers
5. Create main.ts bootstrap

### Phase 4: Integration Testing
1. E2E test: full round lifecycle with NestJS test module
2. Verify NATS message flow with embedded NATS
3. Performance: tick emitter maintains 60fps under load

---

## Files to Create

| File | Layer | Purpose |
|------|-------|---------|
| `src/shared/kernel/Money.ts` | shared | Value object |
| `src/shared/kernel/DomainError.ts` | shared | Base error |
| `src/rng/domain/ProvablyFair.ts` | domain | SHA-512 crash point (GLI-isolable) |
| `src/rng/domain/SeedPair.ts` | domain | Server+client seed value object |
| `src/rng/domain/SeedChain.ts` | domain | Seed rotation |
| `src/engine/domain/Round.ts` | domain | Rich entity: state + rules |
| `src/engine/domain/RoundState.ts` | domain | State enum + transitions |
| `src/engine/domain/CrashPoint.ts` | domain | Value object |
| `src/engine/domain/Multiplier.ts` | domain | Curve calculation |
| `src/engine/domain/GameConfig.ts` | domain | Config interface (plain TS) |
| `src/betting/domain/Bet.ts` | domain | Rich entity: validate, cashout |
| `src/betting/domain/BetStatus.ts` | domain | Status enum |
| `src/betting/domain/BetCollection.ts` | domain | Aggregate |
| `src/engine/application/ports/EventPublisher.ts` | application | Output port |
| `src/engine/application/ports/EventSubscriber.ts` | application | Input port |
| `src/engine/application/ports/TickScheduler.ts` | application | Output port |
| `src/betting/application/ports/BetStore.ts` | application | Output port |
| `src/betting/application/ports/WalletGateway.ts` | application | Output port (operator wallet) |
| `src/betting/application/commands/*.ts` | application | Input/output DTOs |
| `src/betting/application/PlaceBetUseCase.ts` | application | Use case |
| `src/betting/application/CashoutUseCase.ts` | application | Use case |
| `src/engine/application/RunGameLoopUseCase.ts` | application | Main orchestrator |
| `src/messaging/NatsEventPublisher.ts` | infrastructure | Implements EventPublisher |
| `src/messaging/NatsEventSubscriber.ts` | infrastructure | Implements EventSubscriber |
| `src/messaging/messaging.module.ts` | infrastructure | NestJS module |
| `src/betting/infrastructure/InMemoryBetStore.ts` | infrastructure | Implements BetStore |
| `src/betting/infrastructure/wallet-adapters/SoftSwissWalletAdapter.ts` | infrastructure | Implements WalletGateway (SoftSwiss) |
| `src/betting/infrastructure/wallet-adapters/EveryMatrixWalletAdapter.ts` | infrastructure | Implements WalletGateway (EveryMatrix) |
| `src/betting/infrastructure/wallet-adapters/DirectCryptoWalletAdapter.ts` | infrastructure | Implements WalletGateway (direct crypto) |
| `src/engine/infrastructure/SetIntervalTickScheduler.ts` | infrastructure | Implements TickScheduler |
| `src/config/config.module.ts` | infrastructure | Zod validation + NestJS |
| `src/config/game-config.schema.ts` | infrastructure | Zod schema |
| `src/app.module.ts` | infrastructure | Composition root |
| `src/main.ts` | infrastructure | NestJS bootstrap |

---

## Verification

```bash
# 1. Domain tests (pure, no NestJS, no docker)
bun test test/domain/

# 2. Use case tests (mocked ports)
bun test test/application/

# 3. Integration tests (requires docker)
docker compose -f infrastructure/docker/docker-compose.yml up -d nats
bun test test/integration/

# 4. Start the engine
bun run start
# Expected: [GameEngine] Round abc-123 started (crash @ 2.45x)

# 5. Verify domain purity
grep -r "@Injectable\|@Inject\|@Module\|nestjs" src/*/domain/ src/*/application/
# Expected: no matches (zero framework imports in inner layers)
```
