# Aviatrix Development Plan

**3 Engineers, Parallelized**

---

## Overview

Greenfield social crash gaming platform. Priority: Core game first, then warm path social features. Compliance deferred to future phases. Maximum parallelization across three engineers.

---

## Team Structure

### Engineer 1 -- Frontend & UI

Frontend & UI: Player-facing client, rendering pipeline (PixiJS/Three.js), real-time UI updates, Zustand state management

### Engineer 2 -- Game Engine & Realtime

Game Engine & Realtime: Core crash logic (Bun.js hot path), WebSocket infrastructure, NATS pub/sub, RNG & state machine

### Engineer 3 -- Platform & Infrastructure

Platform & Infrastructure: NestJS API gateway, PostgreSQL data layer, Docker/K8s DevOps, Redis caching

---

## Phase 1: Foundation Setup

**Mode:** Parallel

### 1.1 Project Scaffolding

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Create /packages/frontend directory | Create /packages/game-engine directory | Create /packages/platform-api directory |
| Initialize Vite with React 19 template | Initialize Bun.js project (bun init) | Initialize NestJS project (nest new) |
| Configure TypeScript (strict mode) | Configure TypeScript for Bun runtime | Configure TypeScript decorators |
| Setup ESLint + Prettier config | Create /packages/realtime-server directory | Create /infrastructure directory |
| Add path aliases (@/components, etc.) | Setup shared ESLint config | Setup root package.json workspaces |

### 1.2 Core Dependencies

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Install React 19 + ReactDOM | Install uWebSockets.js | Install @nestjs/graphql + Apollo |
| Install Zustand for state management | Install nats (NATS client) | Install @nestjs/typeorm + pg |
| Install PixiJS 8 + @pixi/react | Install protobufjs + ts-proto | Install ioredis + cache-manager |
| Install protobufjs (client decoder) | Install ioredis (Redis client) | Install class-validator + class-transformer |
| Install TailwindCSS or CSS modules | Install vitest for unit testing | Install @nestjs/swagger (OpenAPI) |

### 1.3 Local Dev Environment

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Configure Vite dev server (port 3000) | Configure Bun watch mode | **Create docker-compose.yml** |
| Setup HMR for React components | Setup WebSocket server (port 8080) | Add PostgreSQL 16 container |
| Configure proxy for API routes | Connect to local NATS (port 4222) | Add Redis 7 container |
| Add .env.local template | Add hot reload for game engine | Add NATS JetStream container |
| | | Add Adminer/pgAdmin for DB UI |

### 1.4 Shared Contracts (BLOCKING)

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Review Protobuf schemas | **Create /packages/shared directory** | Review Protobuf schemas |
| Generate TypeScript types from .proto | **Define game.proto (Bet, Cashout, Round)** | **Design PostgreSQL schema** |
| Create WebSocket hook (useGameSocket) | **Define events.proto (Tick, Result)** | Create players table (id, balance, etc.) |
| Implement message encoder/decoder | Setup proto compilation script | Create rounds table (id, crash_point, etc.) |
| | Export shared TypeScript types | Create bets table (player_id, amount, etc.) |

### 1.5 Verification & Smoke Test

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Verify Vite dev server starts | Verify Bun runtime starts | Verify docker-compose up works |
| Render PixiJS canvas (blank stage) | WebSocket accepts connections | NestJS connects to PostgreSQL |
| Connect to WebSocket (handshake only) | NATS connection established | Redis ping/pong succeeds |
| Zustand store initializes correctly | Protobuf encode/decode works | Health check endpoint returns 200 |

**Sync Point 1:** Protocol Buffers schema review & agreement (all engineers) -- All services can start and communicate

---

## Phase 2: Core Game Logic

**Mode:** Parallel

Hot path implementation: betting, multiplier, cashout

### 2.1 Bet Placement

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Create bet amount input with validation | **Validate bet amount against balance** | GET /player/balance endpoint |
| Build quick-bet presets (25%, 50%, 2x) | **Check bet timing (within window)** | POST /player/balance/lock endpoint |
| Add bet confirmation modal | **Lock player funds on placement** | Balance transaction logging |
| Show balance with real-time updates | Store bet in Redis for fast access | Rate limiting on bet endpoints |
| Handle insufficient balance errors | Handle edge: bet at window close | |

### 2.2 Round State Machine (CRITICAL)

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Display round state indicator | **Define states: WAITING, BETTING, FLYING, CRASHED** | Create rounds table schema |
| Show betting window countdown | **Implement state transition guards** | Round state enum in DB |
| Disable bet UI when FLYING | **Betting window timer (configurable)** | Record round start/end timestamps |
| Show "CRASHED" screen on end | **Flying phase tick loop (50ms)** | GraphQL subscription: onRoundState |
| | **Crash trigger logic** | |
| | Round cleanup & next-round init | |
| | Emit state events to NATS/WS | |

### 2.3 Provably Fair RNG (CRITICAL)

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Display server seed hash (pre-round) | **Generate server seed (crypto-secure)** | Store seeds in rounds table |
| Reveal full seed after crash | **Collect client seeds from players** | GET /round/:id/verify endpoint |
| Build verification calculator UI | **SHA-512 hash chain derivation** | Seed history audit log |
| "Provably Fair" info modal | **Crash point formula implementation** | |
| | Seed reveal after round end | |
| | Verification endpoint | |

### 2.4 Multiplier Display

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| **PixiJS canvas for multiplier** | Multiplier tick emitter (50ms) | GraphQL subscription: onTick |
| **Exponential curve animation** | Calculate multiplier at tick | Record final multiplier in DB |
| **Airplane sprite along curve** | Broadcast via WebSocket | |
| Trail effect behind plane | Delta compression for bandwidth | |
| Screen shake on crash | | |
| **Interpolation for 60fps smoothing** | | |

### 2.5 Cashout (CRITICAL)

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Cashout button enabled/disabled | **Validate cashout timing (FLYING)** | Credit winnings to balance |
| Pulse animation during active | **Verify player has active bet** | Record cashout in bets table |
| Click debounce (prevent double) | **Calculate: bet x multiplier** | Transaction integrity (ACID) |
| Pending state while confirming | **Prevent double cashout** | Payout webhook notifications |
| Win amount flash animation | **Race condition: cashout vs crash** | |
| Optimistic UI for latency | Emit cashout event | |
| | Publish win to NATS | |

### 2.6 Game History

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| History row component | Emit round result summary | GET /rounds/history endpoint |
| Color coding (green/red) | Include player stats in event | GET /player/:id/bets endpoint |
| Expandable bet details | | Pagination with cursor |
| Infinite scroll pagination | | Index on round_id, player_id |
| Verify link per round | | |

### 2.7 Auth & Wallet

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Login/signup forms | Validate JWT on WS connect | POST /auth/login endpoint |
| JWT token storage | Map session to player_id | POST /auth/register endpoint |
| Wallet connect button | | JWT generation & refresh |
| Deposit/withdraw modals | | Wallet SDK integration |
| | | Deposit/withdraw endpoints |
| | | Transaction webhook handlers |

**Sync Point 2:** WebSocket message format finalization & end-to-end bet test -- Full bet -> fly -> cashout cycle works

---

## Phase 3: Integration

**Mode:** Sequential + Parallel

NATS message bus, full data flow, round lifecycle

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| **Connect bet UI to WebSocket** | **Define NATS topics spec** | **NATS JetStream streams setup** |
| - Setup WebSocket connection manager with reconnection logic | - Document topic naming conventions | - Configure bets stream (retention: limits) |
| - Implement bet placement message serialization (Protobuf) | - Define message schemas for each topic | - Configure rounds stream (retention: interest) |
| - Add optimistic UI update on bet submission | - Specify retention policies per stream | - Configure analytics stream (retention: workqueue) |
| - Handle bet confirmation/rejection responses | - Create topic registry/constants module | - Setup consumer groups for each service |
| - Implement connection status indicator | - Write integration tests for topic validation | - Implement health checks for NATS connection |
| **Subscribe to multiplier.tick** | **Process bets from NATS queue** | **Round history API endpoint** |
| - Create multiplier subscription handler | - Setup NATS consumer for bet.placed queue | - Create GET /rounds endpoint with pagination |
| - Implement frame interpolation for smooth 60fps display | - Implement bet validation pipeline | - Add filters (date range, crash point range) |
| - Add latency compensation logic | - Add bet to in-memory round state | - Include player participation data |
| - Handle missed tick recovery | - Publish bet.accepted / bet.rejected events | - Implement Redis caching layer |
| - Sync local clock with server time | - Implement dead-letter queue for failed bets | - Add GraphQL resolver for round history |
| **Win/loss result display** | **Emit round events to NATS** | **ClickHouse analytics ingestion** |
| - Design result modal/toast component | - Publish round.starting event | - Setup ClickHouse consumer from NATS |
| - Implement win animation (confetti, sound) | - Publish multiplier.tick at 60Hz | - Define analytics tables schema |
| - Implement crash/loss animation | - Publish cashout.processed events | - Implement batch insert pipeline |
| - Display payout breakdown (bet x multiplier) | - Publish round.crashed event | - Create materialized views for common queries |
| - Add result to local history cache | - Publish round.settled event with final state | - Setup retention policies |
| **Live player bet list** | **Auto-cashout feature** | **Leaderboard API** |
| - Create virtualized list component for performance | - Store auto-cashout targets per player | - Create GET /leaderboard endpoint |
| - Subscribe to bet placement events | - Monitor multiplier against targets | - Implement time-based filters (daily/weekly/all-time) |
| - Real-time update on cashout events | - Execute automatic cashout logic | - Add category filters (biggest win, most wins, etc.) |
| - Show player avatars + bet amounts | - Emit cashout events for auto-cashouts | - Setup Redis sorted sets for real-time updates |
| - Highlight current user's bets | - Handle edge cases (exact crash point) | - Implement cache invalidation strategy |

**Sync Point 3:** Full round lifecycle test (bet -> fly -> cashout/crash)

---

## Phase 4: Warm Path -- Social Features

**Mode:** Parallel

Crews, tournaments, Telegram, streaming

### 4.1 Crew System

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Create crew list/discovery UI | -- | **Create crews table (id, name, owner_id)** |
| Crew detail page layout | | **Create crew_members table** |
| Crew creation modal + form validation | | Crew CRUD API endpoints |
| Crew invitation flow UI | | Crew invitation system (codes, expiry) |
| Member management panel (kick, promote) | | Member role permissions |
| Crew stats dashboard | | Aggregate crew statistics queries |

### 4.2 Crew Chat

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Chat message list component | -- | **Create crew_messages table** |
| Chat input with emoji picker | | WebSocket chat message routing |
| Message timestamp & read receipts | | Message persistence service |
| @mention autocomplete | | Push notification integration |
| Chat moderation tools (delete, mute) | | Chat moderation API (mute, ban) |
| Unread message indicators | | Unread count tracking |

**Sync Point 4a:** Crew messaging E2E test -- create crew, send messages, verify persistence

### 4.3 Tournaments

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Tournament lobby/list view | Define tournament event types | **Create tournaments table** |
| Tournament registration flow | **Tournament lifecycle state machine** | Create tournament_entries table |
| **Live tournament leaderboard (real-time)** | **Tournament scoring engine** | Create tournament_scores table |
| Tournament countdown timer | Prize pool calculation logic | Tournament CRUD API |
| Tournament result/payout screen | Leaderboard update broadcaster | Scheduled tournament cron jobs |
| Tournament history page | | Prize distribution service |

### 4.4 Copy-Bet (Social Betting)

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| "Follow" player button | **Copy-bet execution engine** | **Create follows table** |
| Following/followers list UI | Copy-bet multiplier settings | Create copy_bet_settings table |
| Copy-bet toggle + settings modal | Delay/slippage handling | Copy-bet transaction logging |
| Real-time "copying" indicator | Copy-bet queue processor | Copy-bet fee calculation service |
| Copy-bet history view | Risk limit enforcement | Copy-bet analytics API |
| Copy-bet profit/loss stats | | |

**Sync Point 4b:** Social betting integration test -- tournament with copy-bet participants

### 4.5 Player Profiles & Avatars

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Profile page layout | -- | Add profile fields to players table |
| Avatar upload + crop tool | | **S3 bucket setup for avatars** |
| Username change flow | | Image resize/optimize service (Sharp) |
| Bio/description editor | | Profile update API |
| Stats display (win rate, profit) | | Profile stats aggregation queries |
| Achievement badges display | | Avatar CDN integration |

### 4.6 Streamer Overlay (OBS)

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Overlay URL generator page | WebRTC signaling server | Streamer overlay API endpoint |
| **Standalone overlay React app** | Stream state broadcaster | Overlay authentication tokens |
| Customizable overlay themes | | Overlay config persistence |
| Live bet feed component | | |
| Recent wins ticker | | |
| Overlay preview in dashboard | | |

### 4.7 Telegram Bot Integration

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Telegram link/unlink UI in settings | -- | **Telegram Bot setup (BotFather)** |
| | | Telegram OAuth flow |
| | | Link Telegram ID to player account |
| | | Notification preferences API |
| | | Bot commands: /balance, /bet, /stats |
| | | Round result notifications |

**Sync Point 4c:** Full social feature smoke test -- profiles, streaming, Telegram notifications

---

## Phase 5: Polish & Production Readiness

**Mode:** Parallel

Performance, observability, deployment

| Engineer 1 (Frontend) | Engineer 2 (Game Engine) | Engineer 3 (Platform) |
|------------------------|--------------------------|------------------------|
| Mobile-responsive layouts | Performance optimization (16ms) | Kubernetes deployment (EKS/GKE) |
| Rive animations (plane, crash) | Load testing & tuning | Grafana + Loki observability |
| Adaptive rendering (3D to 2D) | Horizontal scaling prep | Feature Flags (Unleash) |
| Accessibility (a11y) | Audit logging | CI/CD pipeline (GitHub Actions) |

---

## Future Phase: Compliance (Deferred)

- GLI-certified RNG audit
- Per-jurisdiction configuration
- Responsible Gaming SDK
- GeoIP + KYC Adapter
- Immutable Audit Trail

---

## Critical Sync Points & Dependencies

```
Phase 1:  All parallel --------------------------------> SP1 (Protobuf lock)
                                                         |
Phase 2:  All parallel --------------------------------> SP2 (WS format)
                                                         |
Phase 3A: Eng2 -> Eng3 -> Eng1 (NATS setup - sequential) |
Phase 3B: All parallel --------------------------------> SP3 (Round test)
                                                         |
Phase 4+: All parallel (no blocking dependencies)
```

---

## Monorepo Structure

| Path | Owner | Stack |
|------|-------|-------|
| /packages/frontend | Engineer 1 | React 19 + Vite |
| /packages/game-engine | Engineer 2 | Bun.js hot path |
| /packages/realtime-server | Engineer 2 | uWebSockets + NATS |
| /packages/platform-api | Engineer 3 | NestJS |
| /packages/shared | All | Protobuf, TypeScript types |
| /infrastructure | Engineer 3 | Terraform, K8s |

---

## E2E Acceptance Criteria

1. **Bet Placement** -- Player can place bet before round starts
2. **60fps Updates** -- Multiplier updates smoothly in browser
3. **Cashout** -- Returns correct winnings to player
4. **Crash Event** -- Terminates round and settles all bets
5. **History** -- Round history persists and displays correctly
6. **Load Test** -- Handle 10K concurrent players
