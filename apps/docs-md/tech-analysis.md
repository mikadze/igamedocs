# Aviatrix Tech Stack Intelligence Report

**February 2026**

---

## Industry-Standard Tech Stack

The current crash gaming infrastructure across Spribe (Aviator), Turbo Games, SmartSoft (JetX), and Pragmatic Play. Most providers converge on a remarkably similar architecture -- which is both the norm and the vulnerability.

**Legend:**
- [Standard] -- Industry standard
- [Emerging] -- Emerging (2024--26)
- [Aviatrix] -- Aviatrix opportunity
- [Alternative] -- Alternative choice

### Frontend (Player-facing UI)

- [Standard] React / Preact
- [Standard] Canvas / WebGL
- [Standard] PixiJS / Phaser
- [Emerging] Three.js (3D skins)
- [Standard] GSAP animations
- [Aviatrix] Rive (interactive)
- [Standard] Tailwind / CSS-in-JS
- [Emerging] Lottie micro-anims

### Realtime Layer (Multiplier sync & bets)

- [Standard] WebSockets (ws/uws)
- [Standard] Socket.IO
- [Emerging] gRPC-Web
- [Standard] Redis Pub/Sub
- [Aviatrix] NATS / Kafka Streams
- [Alternative] SSE (fallback)

### Game Engine (Core crash logic)

- [Standard] Node.js / TypeScript
- [Alternative] Go (high-perf)
- [Alternative] Rust (new entrants)
- [Standard] Provably Fair RNG
- [Standard] SHA-256 / SHA-512
- [Standard] HMAC seed chaining
- [Aviatrix] Client seed injection

### Platform / API (Operator integration)

- [Standard] REST API (JSON)
- [Standard] GCI / RGS protocol
- [Standard] Seamless wallet API
- [Standard] OAuth 2.0 / JWT
- [Emerging] GraphQL (backoffice)
- [Aviatrix] Webhook event bus
- [Standard] iFrame embed

### Data / Storage (State & analytics)

- [Standard] PostgreSQL
- [Standard] Redis (sessions/cache)
- [Standard] MongoDB (game logs)
- [Emerging] ClickHouse (analytics)
- [Emerging] TimescaleDB
- [Aviatrix] Kafka (event log)
- [Alternative] S3 / MinIO (replays)

### Infra / DevOps (Deploy & scale)

- [Standard] Docker / K8s
- [Standard] AWS / GCP
- [Emerging] Cloudflare Workers
- [Standard] Terraform / Pulumi
- [Standard] CI/CD (GitHub Actions)
- [Standard] Prometheus + Grafana
- [Aviatrix] Edge compute (latency)

### Compliance (Regulatory tech)

- [Standard] GLI-certified RNG
- [Standard] Responsible gaming API
- [Standard] GeoIP + KYC hooks
- [Standard] Session time limits
- [Emerging] AI affordability checks
- [Aviatrix] Per-jurisdiction config
- [Emerging] AML transaction scoring

---

### Deep Dive: Provably Fair -- How It Actually Works

*The cryptographic backbone every crash game shares*

Every crash game in the market uses a variant of the same provably fair system. Here's the chain:

```
// 1. Server generates seed before round
const serverSeed = crypto.randomBytes(32).toString('hex');
const hashedSeed = sha256(serverSeed); // shown to players BEFORE round

// 2. Client seeds injected from first 3 bettors
const clientSeeds = [bettor1.seed, bettor2.seed, bettor3.seed];

// 3. Combined hash -> crash point
const combined = sha512(serverSeed + clientSeeds.join(''));
const crashPoint = calculateMultiplier(combined, houseEdge);

// 4. After round: reveal serverSeed for verification
// Player can verify: sha256(serverSeed) === hashedSeed
```

**Key insight:** Every provider (Spribe, Turbo, SmartSoft) uses this same fundamental pattern. The differentiation is zero at the RNG layer. Aviatrix's opportunity isn't in the fairness algorithm -- it's in everything built *on top* of it.

**GLI certification note:** The RNG module must be isolated, auditable, and certified independently. Novel social mechanics (Copy-Bet, Communal Shield) sit in the game logic layer *above* the RNG, which means they don't require re-certification of the core random engine -- only separate regulatory review of the bonus/social mechanic.

### Deep Dive: Real-Time Architecture -- The 100ms Rule

*Why WebSocket latency is the #1 technical constraint*

Crash games have the **tightest real-time requirement** of any casino game format. The multiplier updates 30--60 times per second for every connected player simultaneously. A player's cash-out must be processed, validated against the server-side crash point, and acknowledged -- all within ~100ms end-to-end.

The industry standard approach: `WebSocket` connections over `ws` or `uws` (uWebSockets), with `Redis Pub/Sub` syncing game state across multiple backend instances. Most providers run a single "game room" per round -- all players subscribe to the same channel and receive identical multiplier ticks.

**Where everyone is weak:** No provider has solved the *social multiplayer* problem at scale. Adding Crews, voice chat, real-time leaderboards, and Copy-Bet means going from 1 channel per round to potentially hundreds of sub-channels -- crew channels, spectator channels, tournament channels. This requires a fundamentally different pub/sub architecture. `NATS` or `Kafka Streams` with partition-per-crew would be the way to handle this without degrading the core 100ms guarantee.

**Aviatrix angle:** Build the real-time layer for social from day one, not as a bolt-on. This is the single hardest technical moat to replicate.

### Deep Dive: Operator Integration -- GCI/RGS Protocol

*The API layer that makes or breaks B2B adoption*

Operators integrate crash games via the **Game Communication Interface (GCI)** or a **Remote Game Server (RGS)** protocol. The game runs on the provider's servers and communicates with the operator's wallet and player management system via standardized API calls.

Typical flow: `Player opens game -> iFrame loads from provider CDN -> Auth token validated -> Wallet balance fetched -> Bets/wins posted back via wallet API`.

Every operator has a slightly different wallet API variant, which means providers maintain **adapter layers** for each integration. The biggest friction in B2B crash gaming is not the game itself -- it's the 2--6 week integration period per operator.

**Industry pain:** No standardized "plug and play" exists. Each provider has proprietary protocols. Aggregators (SoftSwiss, EveryMatrix, SoftGamings) paper over this with unified APIs, but at the cost of added latency and revenue share.

**Aviatrix angle:** Ship a single-endpoint integration SDK that wraps the 5 most common wallet API patterns. Target "1-day integration" for crypto operators and "1-week" for Tier-1 licensed operators. This directly solves Marcus Chen's (Tier-1 operator persona) top pain: *"Launch fast with minimal dev lift."*

---

## Tech Stack Comparison

How the current crash gaming providers compare across key technical dimensions -- and where the whitespace is.

| Dimension | Spribe (Aviator) | Turbo Games | SmartSoft (JetX) | Aviatrix (Target) |
|-----------|-----------------|-------------|-------------------|-------------------|
| Core Language | Node.js | Node.js / Go | Node.js | **Go + TypeScript** |
| Realtime Protocol | WebSocket (Socket.IO) | WebSocket (native ws) | WebSocket (Socket.IO) | **uWebSockets + NATS** |
| Fairness System | Provably Fair (SHA-256/512) | Provably Fair | Certified RNG | **Provably Fair + on-chain audit** |
| 3D / Visual Engine | 2D Canvas only | 2D Canvas only | 2D Canvas + minor 3D | **Three.js + PixiJS hybrid** |
| Social Infrastructure | Partial -- Chat only | None | Partial -- Chat + leaderboard | **Crews, voice, tournaments** |
| Progression System | None | None | None | **Flight Pass + XP + seasons** |
| Cosmetic Economy | None | None | None | **Plane skins, trails, hangars** |
| Copy-Bet / Social Bet | No | No | No | **Copy-Bet + Side Bets** |
| Multi-mode (Survivor etc.) | Single mode | Single mode | Partial -- 2 modes | **Classic / Survivor / Tournament** |
| Telegram Mini App | No | No | No | **Native TMA integration** |
| Integration Time | 2--4 weeks | 2--3 weeks | 2--4 weeks | **1 day (crypto) / 1 week (Tier-1)** |
| Analytics Dashboard | Partial -- Basic | Partial -- Basic | Partial -- Basic | **Real-time + predictive** |
| Edge Deployment | Central only | Central only | Central only | **CDN + edge auth** |

### Key Takeaway

1. Every competitor uses essentially the **same tech stack** -- Node.js + Socket.IO + 2D Canvas + basic provably fair. Zero differentiation at the infrastructure level.
2. **No one** has built social infrastructure, progression systems, or cosmetic economies. This is 100% greenfield -- technically and competitively.
3. Operator integration is a pain everywhere. A **1-day SDK** would be a category-defining competitive advantage in the B2B sales cycle.
4. The visual presentation of every crash game is stuck in **2018**. 3D plane skins, dynamic trails, and Rive animations would be a generation leap in perceived quality.

---

## Technical Challenges

The hard problems Aviatrix must solve -- where most crash game startups stall or fail.

### **Critical** -- Architecture: Real-Time Social at Scale

Adding Crews, Copy-Bet, and Survivor lobbies turns a simple 1-channel-per-round system into a complex multi-topology pub/sub. Each Crew needs its own state channel, Copy-Bet needs sub-100ms relay, and Survivor needs round-aware elimination logic. All concurrent. All under the 100ms ceiling.

**Risk:** Architectural misstep here = latency spikes at scale = player rage = operator churn

### **Critical** -- Regulatory: GLI Certification of Novel Mechanics

Copy-Bet, Communal Shield, and Side Bets have no regulatory precedent in crash gaming. GLI/BMM testing labs need to evaluate these as new game categories. Expect 6--12 months of back-and-forth with testing houses, plus separate submissions per jurisdiction (MGA, UKGC, Curacao).

**Risk:** Regulatory delay = missed market window. Must decouple certified core from social features that can ship earlier in less regulated markets.

### **High** -- Security: Copy-Bet Exploitation Vectors

Copy-Bet creates a new attack surface: colluding accounts could create "guaranteed win" illusions, bot networks could copy high-rollers to amplify exposure, and latency differences between copier/source could create arbitrage. Need rate-limiting, behavioral analysis, and maximum copy-ratio caps built into the protocol layer.

**Risk:** Single exploit going viral on Twitter = catastrophic trust loss

### **High** -- Performance: 3D Rendering on Low-End Devices

Aviatrix targets markets (Africa, India, LatAm) where the median device is a $120 Android phone with 3GB RAM. Three.js plane skins + particle trails + smooth 60fps multiplier animation must degrade gracefully. Needs a multi-tier rendering pipeline: 3D (high-end) -> 2.5D (mid) -> 2D sprite (low).

**Risk:** Beautiful on desktop, unplayable on target audience devices

### **High** -- Data: Event Sourcing at iGaming Scale

Every bet, cash-out, crew action, and skin purchase must be an immutable, auditable event. At 10K concurrent players x 30 rounds/minute, that's ~300K events/minute. The event store must be append-only, replayable, and queryable in real-time for compliance reporting.

**Risk:** Under-engineered event pipeline = compliance failure = license revocation

### **Medium** -- Integration: Multi-Wallet Abstraction Layer

Must simultaneously support fiat (via operator wallet APIs), crypto (direct on-chain), and internal "fun money" for demo/tournament modes. Each has different settlement speeds, error modes, and audit requirements. The wallet abstraction must be airtight -- a bug here is a financial bug.

**Risk:** Wallet bugs are existential. Double-spends, phantom balances, or settlement mismatches destroy operator trust instantly.

### **Medium** -- Ops: Multi-Region Compliance Partitioning

Different jurisdictions require data residency (EU: GDPR, UK: UKGC rules), different RTP floors, different responsible gaming features, and different KYC flows. The platform must partition at the config layer without forking the codebase. Feature flags per jurisdiction, not per codebase.

**Risk:** Codebase forks = maintenance nightmare. Feature flag debt = bugs in production for specific markets.

### **Medium** -- Product: Skin Economy Without Blockchain Dependency

Plane skins need to feel ownable and tradeable without forcing every operator into Web3 infrastructure. Need a dual-track system: off-chain inventory for regulated markets + optional on-chain NFT bridge for crypto operators. Two economies, one asset catalog, seamless cross-mode experience.

**Risk:** Over-indexing on crypto scares Tier-1 operators. Ignoring crypto loses the fast-growth market.

---

## Technical Opportunities

Whitespace in the tech landscape where Aviatrix can build lasting competitive moats.

### **Massive** -- Moat: Social Graph as Infrastructure

No crash game has a social layer. Building Crews, friend lists, follow graphs, and crew-vs-crew history creates a data asset that compounds over time. Every relationship in the social graph is a retention hook and a switching cost. This isn't a feature -- it's a platform play.

**Moat strength:** Networks effects are the strongest moat in tech. Once players have their crew on Aviatrix, they won't leave.

### **Massive** -- Revenue: LiveOps Engine (Seasons + Events)

Build a server-driven LiveOps system that can push new missions, challenges, seasonal themes, limited-time modes, and tournament brackets -- all without client updates. Fortnite's entire retention engine is LiveOps. No crash game has any version of this.

**Revenue impact:** Flight Pass + seasonal skins = recurring non-wagering revenue stream that doesn't touch RTP or house edge.

### **High** -- Distribution: Telegram Mini App -- Native TMA

Telegram's Bot API + Mini App framework lets you ship a fully playable crash game inside Telegram with zero app store friction. Hamster Kombat proved 300M+ users are reachable this way. First crash game on TMA gets the entire crypto-native Telegram audience. The tech is straightforward (Web App bridge + TON wallet), the timing is everything.

**Distribution:** Zero-CAC acquisition channel. Viral coefficient multiplied by group chat dynamics.

### **High** -- Differentiation: Crash Clips -- Shareable Replay System

Record and auto-generate short video clips of big wins, clutch cash-outs, and crew moments. Technically: capture the event log + render a client-side replay with the player's skin, multiplier animation, and crew reactions. Output as shareable MP4/GIF with operator branding watermarked. This is free UA content.

**Viral loop:** Player shares clip -> friend sees branded Aviatrix game -> friend joins operator. Content-driven acquisition without ad spend.

### **High** -- Speed: 1-Day Integration SDK

Package the operator integration as a single npm/pip package with pre-built adapters for the top 10 wallet API patterns (SoftSwiss, EveryMatrix, Salsa, BetConstruct, etc.). Include a local emulator for testing without a live wallet connection. Ship it with OpenAPI spec and Postman collection.

**Sales accelerator:** "Try our game in 4 hours, go live in 24" would be unprecedented in the industry.

### **High** -- Intelligence: AI-Powered Operator Dashboard

Most crash game back-offices show basic GGR and round counts. Build a real-time analytics dashboard with predictive churn alerts, player segment clustering, optimal RTP tuning per market, and anomaly detection for fraud/bot activity. Use the social graph data (crew engagement, Copy-Bet patterns) as unique signals no competitor has access to.

**B2B stickiness:** Operators stay for the intelligence, not just the game. Data lock-in.

### **Medium** -- Experience: WebRTC Crew Voice Chat

Lightweight push-to-talk voice within Crews during rounds. The screaming-at-2x-multiplier moment is inherently viral content. Tech: WebRTC peer connections within crew (max 5--8 players), server-mediated signaling, optional recording for Crash Clips integration.

**Engagement:** Voice transforms gambling from solitary dopamine hit to shared social experience. Completely new category feel.

### **Medium** -- Positioning: Edge-First Architecture

Deploy game state computation on Cloudflare Workers / Durable Objects or AWS Lambda@Edge. Reduces round-trip latency for Africa/LatAm/SEA markets from ~200ms to ~30ms. Also enables per-region data residency compliance automatically. No competitor currently uses edge compute.

**Technical moat:** Lower latency = fairer cash-out timing = measurably better player experience in key growth markets.

---

## Disruption Map

Where each technical innovation sits on the disruption potential vs. implementation difficulty matrix.

### Easy + High Disruption -- "Do these FIRST"

- Telegram Mini App
- Crash Clips
- Flight Pass / Seasons
- 1-Day Integration SDK

### Hard + High Disruption -- "Moon shots"

- Social Graph Infrastructure
- LiveOps Engine
- Real-time Social at Scale
- AI Operator Dashboard

### Medium Difficulty + Medium Disruption

- 3D Plane Skins
- WebRTC Voice Chat
- Copy-Bet System
- Edge Compute Deploy
- Communal Shield

### Easy + Low Disruption -- "Quick wins"

- Lottie Animations
- Dark Mode UI Polish
- Chat Enhancements

### Hard + Low Disruption -- "Avoid"

- Blockchain Skin Bridge
- On-chain Full Audit

### Priority Sequence

1. **Phase 1 (Month 1--3):** Telegram Mini App, Flight Pass skeleton, Crash Clips, 1-Day SDK. High disruption, fast to ship. These land before anyone reacts.
2. **Phase 2 (Month 3--6):** Copy-Bet, 3D skins, Communal Shield, AI dashboard MVP. Medium complexity, huge differentiation. Core feature set that makes the pitch deck irrefutable.
3. **Phase 3 (Month 6--12):** Social Graph infrastructure, LiveOps engine, WebRTC voice, edge compute. These are the *moats*. Hard to build, harder to copy.
4. **Phase 4 (12+):** Blockchain skin bridge, full on-chain audit trail. Only after the core social platform is proven. Don't over-engineer crypto before product-market fit.

---

## Recommended Aviatrix Stack

An opinionated stack built for Aviatrix's specific needs: real-time social crash gaming, multi-jurisdiction compliance, and lightning-fast operator integration.

### Frontend (Player client)

- React 19 + TypeScript
- PixiJS 8 (2D core)
- Three.js (3D skins, opt-in)
- Rive (interactive UI anims)
- Zustand (state mgmt)
- Vite (build)

### Realtime (Multiplayer sync)

- uWebSockets (uws)
- NATS JetStream
- Redis 7 (cache + pub/sub)
- WebRTC (voice, optional)
- Protocol Buffers (wire format)

### Game Engine (Core logic)

- Go 1.23 (game server)
- TypeScript (API + social)
- Provably Fair (SHA-512)
- Isolated RNG module
- Round state machine

### Platform (APIs & integration)

- NestJS (API gateway)
- GraphQL (backoffice)
- REST + OpenAPI 3.1
- Wallet adapter SDK
- Webhook event bus
- Telegram Bot API

### Data (Storage & analytics)

- PostgreSQL 16 (core)
- ClickHouse (analytics)
- Redis 7 (sessions)
- NATS JetStream (event log)
- S3 (replays + clips)

### Infra (Deploy & observe)

- Kubernetes (EKS/GKE)
- Cloudflare (CDN + edge)
- Terraform
- GitHub Actions CI/CD
- Grafana + Loki + Tempo
- Feature flags (Unleash)

### Compliance (Regulatory)

- GLI-certified RNG module
- Per-jurisdiction config engine
- Responsible gaming SDK
- GeoIP + KYC adapter
- Immutable audit trail

---

### Why Go + TypeScript (Not Just Node.js)

*The architectural decision that matters most*

**Go for the game server** -- the core round engine, multiplier computation, and cash-out validation. Go's goroutines handle 100K+ concurrent WebSocket connections with sub-millisecond GC pauses. Node.js's event loop can bottleneck under the sustained throughput of a popular crash game at scale. Go's type safety also reduces the surface area for financial bugs.

**TypeScript (NestJS) for everything else** -- API gateway, social graph, LiveOps engine, operator dashboard, Telegram bot. These are CRUD-heavy, integration-heavy services where Node.js/TypeScript's ecosystem is unmatched. NestJS gives you dependency injection, guards, and module patterns that keep a multi-team codebase clean.

**The boundary:** Go handles the "hot path" (multiplier tick -> cash-out -> wallet debit) and TypeScript handles the "warm path" (friend requests, skin inventory, tournament brackets, analytics ingestion). They communicate via NATS JetStream -- async, durable, and partition-tolerant.

This split lets you hire differently too: game engine engineers (Go/Rust background, financial systems experience) vs. product engineers (TypeScript/React, social/consumer app experience). Two different talent pools, both essential.

### Team Size & Hiring Roadmap

*Minimum viable team to execute this stack*

**Phase 1 team (5--7 engineers):**

- 1x **Game Engine Lead** (Go, real-time systems, financial correctness) -- this is the hardest hire and the most critical. Look for ex-fintech, ex-trading systems, or ex-multiplayer game server engineers.
- 2x **Frontend Engineers** (React + PixiJS/Canvas, one senior) -- responsible for the client, rendering pipeline, and the adaptive quality system for low-end devices.
- 1x **Platform/API Engineer** (TypeScript/NestJS) -- builds the operator SDK, wallet adapter layer, and integration pipeline.
- 1x **DevOps/SRE** (K8s, Terraform, monitoring) -- critical from day one. Crash games have zero tolerance for downtime.
- 0.5x **Security Engineer** (can be fractional/consultant) -- RNG audit, penetration testing, Copy-Bet exploit analysis.

**Phase 2 additions (+3--5):** Social backend engineer, data/analytics engineer, mobile specialist (Telegram TMA + responsive), QA automation engineer.

**Phase 3 additions (+2--3):** ML engineer (fraud detection, player segmentation), compliance/regulatory tech engineer, additional frontend for LiveOps tools.

---

## The 5 Technical Bets That Define Aviatrix

1. **Go game server** -- 10x throughput headroom over Node.js competitors at the same infrastructure cost. The hot path must be fast and correct.
2. **NATS over Redis-only** -- purpose-built for the multi-channel social topology (Crews, tournaments, Copy-Bet). Redis alone can't partition per-crew at scale.
3. **Adaptive rendering pipeline** -- auto-detect device capability and serve 3D/2.5D/2D accordingly. Win on $120 phones, dazzle on desktops.
4. **Feature flags per jurisdiction** -- single codebase, infinite market configurations. Ship Copy-Bet in Curacao while it's still in GLI review for MGA.
5. **Crash Clips as a first-class system** -- event-log replay -> client-side render -> shareable MP4. Turns every big win into a UA asset.
