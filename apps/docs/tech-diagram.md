# Aviatrix Platform Architecture

High-level technical architecture for the Aviatrix social crash gaming platform.

## Architecture Diagram

```mermaid
flowchart TB
    subgraph External["External Actors"]
        Players["👤 Players"]
        Telegram["📱 Telegram"]
        Streamers["🎮 Streamers"]
        Operators["🏢 Operators"]
    end

    subgraph Frontend["🔵 Frontend Layer"]
        React["React 19 + TypeScript"]
        PixiJS["PixiJS 8"]
        ThreeJS["Three.js"]
        Rive["Rive"]
        Zustand["Zustand"]
        Vite["Vite"]
    end

    subgraph Realtime["🟢 Realtime Layer"]
        uWS["µWebSockets"]
        NATS["NATS JetStream"]
        Redis["Redis 7"]
        WebRTC["WebRTC"]
        Protobuf["Protocol Buffers"]
    end

    subgraph Engine["🟠 Game Engine (Hot Path)"]
        Bun["Bun.js"]
        TS["TypeScript"]
        PF["Provably Fair SHA-512"]
        RNG["Isolated RNG Module"]
        StateMachine["Round State Machine"]
    end

    subgraph Platform["🟣 Platform / API"]
        NestJS["NestJS"]
        GraphQL["GraphQL"]
        REST["REST + OpenAPI 3.1"]
        WalletSDK["Wallet Adapter SDK"]
        Webhooks["Webhook Event Bus"]
        TelegramAPI["Telegram Bot API"]
    end

    subgraph Data["🔴 Data Layer"]
        PostgreSQL["PostgreSQL 16"]
        ClickHouse["ClickHouse"]
        RedisCache["Redis 7 Cache"]
        NATSStream["NATS JetStream"]
        S3["S3"]
    end

    subgraph Infra["🟡 Infrastructure"]
        K8s["Kubernetes EKS/GKE"]
        Cloudflare["Cloudflare"]
        Terraform["Terraform"]
        GitHub["GitHub Actions"]
        Grafana["Grafana + Loki + Tempo"]
        Unleash["Feature Flags Unleash"]
    end

    subgraph Compliance["⚪ Compliance"]
        GLI["GLI-certified RNG"]
        JurisdictionConfig["Per-jurisdiction Config"]
        ResponsibleGaming["Responsible Gaming SDK"]
        KYC["GeoIP + KYC Adapter"]
        AuditTrail["Immutable Audit Trail"]
    end

    %% External connections
    Players -->|WebSocket| Frontend
    Telegram -->|Bot API| Platform
    Streamers -->|RTMP/WebRTC| Realtime
    Operators -->|REST/Webhook| Platform

    %% Layer connections
    Frontend --> Realtime
    Realtime --> Engine
    Engine --> Platform
    Platform --> Data
    Data --> Infra
    Infra --> Compliance

    %% Cross-layer connections
    Realtime -.-> Data
    Engine -.-> Data
    Platform -.-> Compliance
```

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant P as Player
    participant FE as Frontend
    participant WS as µWebSockets
    participant NATS as NATS JetStream
    participant GO as Go Engine
    participant PG as PostgreSQL
    participant OP as Operator

    P->>FE: Place Bet
    FE->>WS: bet.place (Protobuf)
    WS->>NATS: Publish to game.bets
    NATS->>GO: Process bet
    GO->>PG: Record bet
    GO->>NATS: Confirm bet
    NATS->>WS: Broadcast to room
    WS->>FE: bet.confirmed
    FE->>P: Show bet placed

    Note over GO: Round starts, multiplier ticks

    loop Every 16ms
        GO->>NATS: multiplier.tick
        NATS->>WS: Broadcast
        WS->>FE: Update display
    end

    P->>FE: Cash Out
    FE->>WS: cashout.request
    WS->>GO: Validate & process
    GO->>PG: Record win
    GO->>OP: Wallet credit (async)
    GO->>NATS: cashout.confirmed
    NATS->>WS: Broadcast
    WS->>FE: Show win
```

## Component Relationships

```mermaid
graph LR
    subgraph HotPath["Hot Path (Bun.js)"]
        GameServer["Game Server"]
        RNGModule["RNG Module"]
        BetProcessor["Bet Processor"]
        CashoutValidator["Cashout Validator"]
    end

    subgraph WarmPath["Warm Path (TypeScript)"]
        APIGateway["API Gateway"]
        SocialService["Social Service"]
        CrewManager["Crew Manager"]
        TournamentEngine["Tournament Engine"]
    end

    subgraph MessageBus["Message Bus"]
        NATSCore["NATS JetStream"]
    end

    GameServer --> NATSCore
    BetProcessor --> NATSCore
    CashoutValidator --> NATSCore

    NATSCore --> APIGateway
    NATSCore --> SocialService
    NATSCore --> CrewManager
    NATSCore --> TournamentEngine

    style HotPath fill:#f7a733,stroke:#333
    style WarmPath fill:#a855f7,stroke:#333
    style MessageBus fill:#22c55e,stroke:#333
```

## Technology Stack Summary

| Layer | Primary Tech | Purpose |
|-------|--------------|---------|
| Frontend | React 19, PixiJS 8, Three.js | Player UI, 2D/3D rendering |
| Realtime | µWebSockets, NATS JetStream | WebSocket connections, pub/sub |
| Game Engine | Bun.js, TypeScript | Core crash logic, hot path |
| Platform | NestJS, TypeScript | API gateway, social features |
| Data | PostgreSQL, ClickHouse | Transactions, analytics |
| Infra | Kubernetes, Cloudflare | Deployment, edge compute |
| Compliance | GLI RNG, Feature Flags | Regulatory, per-jurisdiction config |

## Key Architectural Decisions

1. **Bun.js for hot path** — Native TypeScript runtime with built-in WebSocket support, fast startup, unified codebase
2. **NATS JetStream** — Multi-channel social topology for Crews, tournaments, Copy-Bet
3. **Adaptive rendering** — Auto-detect device: 3D → 2.5D → 2D sprite fallback
4. **Feature flags per jurisdiction** — Single codebase, infinite market configurations
