# Go vs Node.js

## CCU Breakpoint Analysis -- Where the difference becomes real

---

## CCU Phase Overview

| Phase | CCU Range | Description |
|-------|-----------|-------------|
| Phase 1 | 0 -- 5K CCU | No Difference |
| Phase 2 | 5K -- 15K CCU | Minor Edge |
| Phase 3 | 15K -- 50K CCU | Clear Advantage |
| Phase 4 | 50K -- 150K CCU | Critical Gap |
| Phase 5 | 150K+ CCU | Node.js Breaks |

---

## Metric Comparison at 25K CCU

### Cash-Out P99 Latency

| Runtime | Value |
|---------|-------|
| Go | 12ms |
| Node | 45ms |
| **Difference** | **-33ms** |

**At 25K CCU:** Node.js event loop contention adds ~15ms jitter. Players start noticing "laggy" cash-outs. Go remains flat.

### Server Instances Required

| Runtime | Value |
|---------|-------|
| Go | 1 |
| Node | 4 |
| **Difference** | **-3 fewer** |

**At 25K CCU:** Go handles this on a single c5.2xlarge. Node.js needs 4 instances + load balancer. Each instance adds deployment complexity and failure surface.

### Monthly Infrastructure Cost

| Runtime | Value |
|---------|-------|
| Go | $580 |
| Node | $1,000 |
| **Difference** | **-$420/mo** |

**At 25K CCU:** Go saves ~$420/mo in compute alone. Annualized: $5,040. Not yet enough to offset the ~$50K salary premium -- that crossover happens around 40K CCU.

### Latency Spike Risk

| Runtime | Value |
|---------|-------|
| Go | ~0.1% |
| Node | ~2% |
| **Risk Level** | **Low** |

**At 25K CCU:** Node.js shows occasional GC + event loop stalls causing >200ms spikes on ~2% of rounds. Go GC pauses stay under 1ms. Players on Node.js report "the game stole my cash-out" 3x more often.

### Memory Per Instance

| Runtime | Value |
|---------|-------|
| Go | 1.2 GB |
| Node | 3.0 GB |
| **Difference** | **-1.8 GB** |

**At 25K CCU:** Node.js V8 heap grows unpredictably under sustained WebSocket pressure. Go's memory is more deterministic -- each goroutine stack is small and shrinkable.

### Annual Total Cost (Infra + 1 Lead Engineer)

| Runtime | Value |
|---------|-------|
| Go | $187K |
| Node | $142K |
| **Difference** | **Go costs +$45K** |

**At 25K CCU:** Go engineer ($180K) + infra ($7K) = $187K. Node engineer ($130K) + infra ($12K) = $142K. Go is still more expensive total. **Crossover at ~40K CCU** where infra savings exceed salary delta.

---

## Critical Crossover Points

Exact CCU thresholds where each dimension flips from "doesn't matter" to "game-changing."

| Dimension | Crossover CCU | What happens at this threshold | Impact Severity |
|-----------|---------------|-------------------------------|-----------------|
| First latency spike | ~5,000 | Node.js event loop starts showing occasional >100ms ticks under JSON serialization load. Go stays flat. **Players don't notice yet** -- spikes are rare (~0.1% of rounds). | **Low** |
| Node.js needs clustering | ~8,000 | Single Node.js process hits memory/CPU ceiling. Must add PM2 cluster or multiple instances + sticky sessions. Go handles 8K on a single goroutine pool effortlessly. | **Medium** |
| Player-visible latency gap | ~15,000 | Node.js p99 latency crosses **50ms** -- the threshold where players start perceiving cash-out delay. Go p99 is still ~15ms. Support tickets about "stolen bets" begin on Node.js. | **High** |
| Infra cost crossover | ~25,000 | Node.js infra cost exceeds Go infra cost by enough to offset 50% of the Go salary premium. **Node.js needs 4x the instances.** Load balancer complexity adds ops burden. | **High** |
| Total cost crossover (infra + salary) | ~40,000 | Annual Go infra savings exceed the annual Go salary premium. **Go becomes cheaper in total.** Every CCU above 40K makes Go increasingly economical. | **Critical** |
| Node.js stability degradation | ~50,000 | Node.js GC pauses + event loop saturation cause **5--8% of rounds** to experience >200ms spikes. Cash-out fairness is measurably compromised. Go still has p99 < 20ms. | **Critical** |
| Node.js architecture ceiling | ~80,000 | Node.js requires **10+ instances**, shared-nothing session architecture, complex sticky routing. Adding social features (Crews, Copy-Bet) at this scale requires a ground-up rewrite. Go is at ~2 instances. | **Existential** |
| Node.js hard wall | ~150,000 | Node.js with Socket.IO physically cannot maintain this many connections even across a cluster without custom connection pooling that essentially reinvents what Go does natively. **You must rewrite.** | **Existential** |

---

## The Journey Through CCU Scale

What you'd actually experience at each stage, from both perspectives.

### 0 -- 5,000 CCU: Identical experience

Both runtimes handle this without breaking a sweat. A single Node.js process or a single Go binary. Latency is indistinguishable. **If you're not sure you'll survive past this stage, Node.js is the rational choice** -- cheaper engineer, faster prototyping, larger package ecosystem. The performance difference is literally invisible to players.

### 5,000 -- 15,000 CCU: First cracks appear

Node.js needs its first architectural decision: cluster mode or multiple instances? Sticky sessions for WebSocket affinity? You start spending engineering time on infrastructure instead of features. Go just... works. Same binary, same config, no scaling decisions needed yet. **The difference isn't performance -- it's engineering velocity.** The Go team ships features while the Node team tunes infrastructure.

### 15,000 -- 50,000 CCU: The gap becomes undeniable

This is the **make-or-break range for Aviatrix**. Node.js p99 latency crosses the perception threshold. Players feel it. Operators see churn metrics tick up. Infra bills diverge: Node needs 6--8 instances where Go uses 1--2. **Total cost crossover happens at ~40K CCU** -- from this point forward, Go is cheaper in every dimension. Adding Crews and Copy-Bet to a Node.js cluster at this scale is an architectural nightmare; the shared-nothing model fights stateful social features at every turn.

### 50,000 -- 150,000 CCU: Node.js becomes a liability

**This is where startups on Node.js either rewrite or die.** The combination of 10+ instances, complex session routing, GC-induced latency spikes, and the inability to add stateful social features without a ground-up rearchitecture creates an engineering crisis. The rewrite costs $150--250K and takes 3--4 months -- during which you're shipping zero new features while competitors catch up. Go teams at this scale add a second instance, tune some configs, and keep shipping.

### 150,000+ CCU: Go's domain, Node.js doesn't play

Go handles 500K+ CCU on 4--6 well-tuned instances. Node.js cannot physically maintain this connection count without reinventing connection management from scratch. The infra cost gap is now **$40K--60K/month**. At this scale, you're saving the salary of an entire senior engineer -- every single month -- just on infrastructure. **Rust would save another ~30% on top of Go, but hiring 3 Rust engineers at this stage would cost more than the savings.**

---

## Decision Framework

1. **Below 5K CCU:** It genuinely doesn't matter. Pick whatever your team knows. Ship fast.
2. **5K--15K CCU:** Go gives you engineering velocity (not performance). You spend time building features instead of scaling Node.js.
3. **15K--50K CCU:** The gap is player-visible. Latency, cost, and stability all favor Go. Total cost crossover at ~40K. This is Aviatrix's likely growth trajectory in months 6--12.
4. **50K+ CCU:** Node.js requires a full rewrite. Go just needs a second instance. The rewrite costs more than the Go salary premium for the entire preceding period.
5. **The real question isn't "when does Go win?"** It's "do you believe Aviatrix will pass 15K CCU?" If yes, Go. If you're not sure, start Node.js and plan for the rewrite at 15K.
6. **Hidden factor: social features.** Crews, Copy-Bet, and tournaments are inherently stateful. Go's goroutine-per-connection model handles stateful social logic naturally. Node.js's shared-nothing cluster model fights it.
