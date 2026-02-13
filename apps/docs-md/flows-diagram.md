# Aviatrix Platform Integration Flows

How the Aviatrix social crash gaming platform connects to external systems, operators, players, and third-party services. Complements the [Architecture Diagram](tech-diagram.md) with a focus on integration boundaries and data flows.

## System Context Diagram

```mermaid
flowchart TB
    subgraph Actors["👤 External Actors"]
        Player["Player (Browser)"]
        TelegramUser["Player (Telegram Mini App)"]
        Streamer["Streamer / Creator"]
        Operator["iGaming Operator"]
        Aggregator["Game Aggregator"]
    end

    subgraph Aviatrix["🟠 AVIATRIX PLATFORM"]
        Frontend["React Frontend"]
        RealtimeLayer["Realtime Layer"]
        GameEngine["Game Engine (Bun.js)"]
        PlatformAPI["Platform API (NestJS)"]
        DataLayer["Data Layer"]
    end

    subgraph OperatorSystems["🏢 Operator Systems"]
        OperatorWallet["Operator Wallet API"]
        OperatorBackend["Operator Backend"]
        OperatorIFrame["Operator Site (iFrame)"]
        WalletAdapters["SoftSwiss / EveryMatrix"]
    end

    subgraph ExternalServices["🌐 External Services"]
        TelegramAPI["Telegram Bot API"]
        SocialMedia["TikTok / Instagram / WhatsApp"]
        CDN["Cloudflare CDN"]
        PaymentRails["Payment Processors"]
    end

    subgraph Compliance["⚖️ Compliance & Regulatory"]
        GLI["GLI / eCOGRA / BMM"]
        KYCProvider["GeoIP + KYC Providers"]
        Jurisdictions["Curaçao / MGA / UKGC"]
    end

    subgraph Infra["🟡 Infrastructure"]
        K8s["Kubernetes (EKS/GKE)"]
        Observability["Grafana + Loki + Tempo"]
        FeatureFlags["Unleash Feature Flags"]
    end

    %% Actor → Aviatrix
    Player -->|"HTTPS + WebSocket"| Frontend
    TelegramUser -->|"TMA Web Bridge"| TelegramAPI
    TelegramAPI -->|"Bot API + Webhooks"| PlatformAPI
    Streamer -->|"WebRTC + Dashboard"| RealtimeLayer
    Operator -->|"REST / GraphQL"| PlatformAPI
    Aggregator -->|"GCI / RGS Protocol"| PlatformAPI

    %% Internal
    Frontend -->|"WebSocket (Protobuf)"| RealtimeLayer
    RealtimeLayer -->|"NATS JetStream"| GameEngine
    GameEngine -->|"Events"| PlatformAPI
    PlatformAPI -->|"Read / Write"| DataLayer

    %% External services
    Frontend -->|"Static Assets"| CDN
    PlatformAPI -->|"Share Links + Clips"| SocialMedia
    PlatformAPI -->|"Deposits / Withdrawals"| PaymentRails

    %% Operator systems
    PlatformAPI -->|"Wallet Adapter SDK"| OperatorWallet
    PlatformAPI -->|"Webhooks (game events)"| OperatorBackend
    OperatorWallet ---|"Adapter Layer"| WalletAdapters
    Frontend -->|"Embedded via"| OperatorIFrame

    %% Compliance
    GameEngine -.->|"RNG Audit"| GLI
    PlatformAPI -.->|"KYC / AML Checks"| KYCProvider
    PlatformAPI -.->|"License Compliance"| Jurisdictions

    %% Infrastructure
    DataLayer -->|"Deployed on"| K8s
    PlatformAPI -.->|"Metrics + Logs"| Observability
    PlatformAPI -.->|"Config"| FeatureFlags
```

## Integration Flows

```mermaid
flowchart LR
    subgraph Entry["🔵 Player Entry Points"]
        Browser["Browser"]
        TMA["Telegram Mini App"]
        DeepLink["Deep Link / QR"]
    end

    subgraph Core["🟠 Aviatrix Core"]
        FE["React Frontend"]
        WS["µWebSockets"]
        NATS["NATS JetStream"]
        Engine["Game Engine"]
        API["Platform API"]
    end

    subgraph Data["🔴 Data Stores"]
        PG["PostgreSQL 16"]
        CH["ClickHouse"]
        Redis["Redis 7"]
        S3["S3"]
    end

    subgraph OpInt["🟣 Operator Integration"]
        WalletSDK["Wallet Adapter SDK"]
        WebhookBus["Webhook Event Bus"]
        RGS["RGS / GCI Protocol"]
    end

    subgraph Social["🟢 Social Distribution"]
        TikTok["TikTok"]
        Instagram["Instagram"]
        WhatsApp["WhatsApp"]
        TelegramBot["Telegram Bot API"]
    end

    subgraph Comply["⚖️ Compliance"]
        GeoIP["GeoIP Provider"]
        KYC["KYC Provider"]
        RNGCert["GLI / BMM"]
    end

    %% Player entry
    Browser -->|"HTTPS"| FE
    TMA -->|"Web Bridge"| TelegramBot
    TelegramBot -->|"REST Webhooks"| API
    DeepLink -->|"Redirect"| FE

    %% Internal hot path
    FE -->|"WSS (Protobuf)"| WS
    WS -->|"Publish bets"| NATS
    NATS -->|"Subscribe"| Engine
    Engine -->|"Round events"| NATS
    NATS -->|"Broadcast"| WS

    %% Data persistence
    Engine -->|"Transactions"| PG
    NATS -->|"Analytics stream"| CH
    WS -->|"Sessions"| Redis
    Engine -->|"Replays"| S3

    %% Operator integration
    API -->|"Wallet debit/credit"| WalletSDK
    API -->|"Game events"| WebhookBus
    API -->|"Game launch"| RGS

    %% Social distribution
    API -->|"Crash Clips"| TikTok
    API -->|"Black Box Cards"| Instagram
    API -->|"Crew Invites"| WhatsApp

    %% Compliance
    API -->|"IP Lookup"| GeoIP
    API -->|"Identity Check"| KYC
    Engine -.->|"Isolated RNG Audit"| RNGCert

    style Core fill:#1a1a2e,stroke:#f7a733,stroke-width:2px
    style Entry fill:#0c2d48,stroke:#00d2ff
    style Data fill:#1a1a2e,stroke:#ec4899
    style OpInt fill:#1a1a2e,stroke:#a855f7
    style Social fill:#0c2d48,stroke:#22c55e
    style Comply fill:#1a1a2e,stroke:#eab308
```

## Player Journey Flow

```mermaid
sequenceDiagram
    participant P as Player
    participant QR as Deep Link / QR
    participant CF as Cloudflare CDN
    participant FE as React Frontend
    participant WS as µWebSockets
    participant NATS as NATS JetStream
    participant ENG as Game Engine
    participant PG as PostgreSQL
    participant API as Platform API

    Note over P,API: PATH 1 — Direct Browser Access

    P->>CF: Visit aviatrix.bet
    CF->>FE: Serve static assets (edge cached)
    FE->>API: Auth (JWT token)
    API->>FE: Session token + player profile
    FE->>WS: Open WebSocket (Protobuf handshake)
    WS->>FE: Connected + current round state

    Note over P,API: PATH 2 — Deep Link / QR Code

    P->>QR: Scan QR (from Black Box card or Crash Clip)
    QR->>FE: Redirect with referral + campaign params
    FE->>API: Register / Login + track attribution
    API->>PG: Create player record with referral chain

    Note over P,API: PATH 3 — Telegram Mini App

    P->>API: Open Telegram Mini App
    API->>API: Validate Telegram initData
    API->>PG: Link Telegram ID to player account
    API->>FE: Launch game in TMA WebView
    FE->>WS: WebSocket connection (same as Path 1)

    Note over P,API: GAMEPLAY — All Paths Converge

    FE->>WS: bet.place (amount, auto-cashout)
    WS->>NATS: Publish to game.bets
    NATS->>ENG: Process bet
    ENG->>PG: Lock funds + record bet
    ENG->>NATS: bet.confirmed
    NATS->>WS: Broadcast to room
    WS->>FE: Show bet placed

    loop Multiplier Ticks (every 16ms)
        ENG->>NATS: multiplier.tick
        NATS->>WS: Broadcast
        WS->>FE: Update display
    end

    P->>FE: Cash Out
    FE->>WS: cashout.request
    WS->>ENG: Validate (< crash point?)
    ENG->>PG: Credit winnings
    ENG->>NATS: cashout.confirmed
    NATS->>WS: Broadcast
    WS->>FE: Show win animation

    Note over P,API: POST-GAME — Viral Loop

    FE->>API: Generate Black Box replay card
    API->>P: Black Box card with QR deep link
    P->>P: Share to TikTok / WhatsApp / Instagram
```

## Operator Integration Flow

```mermaid
sequenceDiagram
    participant OP as Operator Backend
    participant API as Platform API
    participant SDK as Wallet Adapter SDK
    participant OW as Operator Wallet
    participant WH as Webhook Event Bus
    participant ENG as Game Engine
    participant FE as Player Frontend
    participant PLR as Player

    Note over OP,PLR: PHASE 1 — Integration Setup

    OP->>API: Register operator (API key + config)
    API->>OP: Operator credentials + SDK bundle
    OP->>SDK: Install Wallet Adapter SDK
    SDK->>OW: Configure wallet endpoint mapping
    OP->>API: Configure webhook endpoints
    API->>OP: Integration test suite (sandbox)

    Note over OP,PLR: PHASE 2 — Game Launch (iFrame)

    PLR->>OP: Open crash game on operator site
    OP->>API: Launch game (operator_token + player_token)
    API->>API: Validate operator + player
    API->>FE: Serve game in iFrame
    FE->>PLR: Game loaded

    Note over OP,PLR: PHASE 3 — Wallet Flows

    PLR->>FE: Place bet ($10)
    FE->>ENG: bet.place
    ENG->>SDK: Debit $10 from player
    SDK->>OW: POST /wallet/debit (player_id, amount, round_id)
    OW->>SDK: 200 OK (new_balance)
    SDK->>ENG: Funds locked

    Note over ENG: Round plays out...

    ENG->>SDK: Credit $25 (cashout at 2.5x)
    SDK->>OW: POST /wallet/credit (player_id, amount, round_id)
    OW->>SDK: 200 OK (new_balance)
    ENG->>FE: Win confirmed

    Note over OP,PLR: PHASE 4 — Event Webhooks

    ENG->>WH: Round completed event
    WH->>OP: POST /webhooks/game-event (round_result)
    ENG->>WH: Player cashout event
    WH->>OP: POST /webhooks/game-event (cashout_details)
    ENG->>WH: Tournament result event
    WH->>OP: POST /webhooks/tournament (leaderboard, prizes)

    Note over OP,PLR: PHASE 5 — Analytics & Reporting

    OP->>API: GET /operator/analytics (date_range, metrics)
    API->>OP: GGR, player counts, round stats
    OP->>API: GET /operator/players (activity, LTV)
    API->>OP: Player engagement data
```

## Streamer & Social Distribution Flow

```mermaid
flowchart LR
    subgraph Streamer["🎮 Streamer"]
        StreamerPC["Streamer PC"]
        OBS["OBS / Streaming Software"]
    end

    subgraph PilotSeat["🟠 Pilot's Seat"]
        Dashboard["Streamer Dashboard"]
        WebRTCSig["WebRTC Signaling"]
        Overlay["OBS Overlay"]
    end

    subgraph Platform["🔵 Aviatrix Platform"]
        API["Platform API"]
        Realtime["Realtime Layer"]
        ClipEngine["Crash Clips Engine"]
    end

    subgraph Viewers["👀 Viewer Journey"]
        Twitch["Twitch / Kick / YouTube"]
        Viewer["Viewer"]
        CopyBet["Copy-Bet Action"]
    end

    subgraph Viral["🟢 Viral Distribution"]
        BlackBox["Black Box Replay Card"]
        CrashClip["Crash Clip (MP4)"]
        QRCode["QR + Deep Link"]
        TikTok["TikTok"]
        WhatsApp["WhatsApp"]
        IG["Instagram"]
    end

    subgraph Acquire["🔴 New Player Acquisition"]
        Scan["Scan QR / Click Link"]
        Register["Register + Play"]
    end

    %% Streamer flow
    StreamerPC -->|"Login"| Dashboard
    Dashboard -->|"Host Lobby"| API
    Dashboard -->|"WebRTC"| WebRTCSig
    WebRTCSig -->|"Stream State"| Realtime
    OBS -->|"Browser Source"| Overlay
    Overlay -->|"Subscribe events"| Realtime

    %% Viewer flow
    StreamerPC -->|"Stream to"| Twitch
    Twitch -->|"Watch"| Viewer
    Viewer -->|"Click overlay link"| API
    Viewer -->|"Copy-Bet pilot"| CopyBet
    CopyBet -->|"Mirror bet"| Realtime

    %% Viral content
    Realtime -->|"Round replay data"| ClipEngine
    ClipEngine -->|"Generate"| BlackBox
    ClipEngine -->|"Generate"| CrashClip
    BlackBox -->|"Embed"| QRCode
    CrashClip -->|"Share"| TikTok
    BlackBox -->|"Share"| WhatsApp
    CrashClip -->|"Share"| IG

    %% Acquisition
    QRCode -->|"Opens"| Scan
    TikTok -->|"CTA link"| Scan
    Scan -->|"Deep link"| Register
    Register -->|"Joins platform"| API

    style PilotSeat fill:#1a1a2e,stroke:#f7a733,stroke-width:2px
    style Viral fill:#0c2d48,stroke:#22c55e,stroke-width:2px
    style Acquire fill:#0c2d48,stroke:#e84545,stroke-width:2px
```

## Integration Summary

| Flow | Direction | Protocol | Data Format | Latency Target |
|------|-----------|----------|-------------|----------------|
| Player → Frontend | Inbound | HTTPS | HTML/JS/CSS | < 200ms (CDN edge) |
| Frontend ↔ Game Engine | Bidirectional | WebSocket | Protocol Buffers | < 50ms |
| Game Engine → Data | Outbound | TCP | SQL / Binary | < 10ms |
| Game Events → Analytics | Outbound | NATS JetStream | JSON | < 1s (async) |
| Platform ↔ Operator Wallet | Bidirectional | HTTPS REST | JSON | < 100ms |
| Platform → Operator Webhooks | Outbound | HTTPS POST | JSON | < 5s (async) |
| Telegram Mini App ↔ Platform | Bidirectional | HTTPS REST | JSON | < 200ms |
| Crash Clips → Social | Outbound | HTTPS API | MP4 / Image | Async (batch) |
| Platform → KYC/GeoIP | Outbound | HTTPS REST | JSON | < 500ms |
| RNG Module → GLI | Offline | Source Code Audit | TypeScript | N/A (manual) |
| Services → Observability | Outbound | OTLP / HTTP | Logs + Traces | < 1s (async) |

## External System Dependencies

| System | Purpose | Criticality | Fallback |
|--------|---------|-------------|----------|
| Cloudflare CDN | Static asset delivery + edge caching | High | Direct origin serve |
| NATS JetStream | Internal event bus + message persistence | Critical | No fallback (core infra) |
| PostgreSQL 16 | Transactional data (bets, players, rounds) | Critical | Read replica failover |
| Redis 7 | Session cache, leaderboards, pub/sub | High | Degrade to DB-only mode |
| ClickHouse | Analytics and reporting | Medium | Queue events, replay later |
| S3 | Replay storage, clips, avatars | Medium | Local disk buffer |
| Telegram Bot API | Telegram Mini App + notifications | Medium | Web-only mode |
| GeoIP Provider | Jurisdiction detection | High | Default to most restrictive |
| KYC Provider | Identity verification | High (regulated) | Block play until verified |
| GLI / BMM | RNG certification | Critical (pre-launch) | Cannot operate without |
| Unleash | Feature flags per jurisdiction | Medium | Static default config |
| Grafana Stack | Observability (logs, metrics, traces) | Medium | Blind-fly mode |
