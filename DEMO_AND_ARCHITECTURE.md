# SynapseOps — Demo Video Script & Technical Architecture Guide

> **Prepared for Graph Hacks Hackathon 2026 Presentation & Rule 12 Compliance**

---

## 🎬 2.5-Minute Hackathon Demo Video Script



### ⏱️ 0:00 – 0:30 · Hook & The Critical Rule 3 Foundation
- **Visual**: Start on the SynapseOps SRE Command Center. Point to the header showing `FalkorDB: synapse_tenant_acme-fintech`.
- **Speech**:
  > *"Judges, this is **SynapseOps**—an enterprise Self-Learning Multi-Agent Incident War Room built for Graph Hacks Track 2: Agent Memory and Coordination, and Track 1: Agents That Act on Connected Data.*
  >
  > *Before we dispatch our agents, here is our core architectural guarantee: **FalkorDB is doing 100% of the cognitive work**. Our agents do not pass state to each other in JavaScript memory. Every memory lookup, blast-radius calculation, multi-agent handoff, and reinforcement learning update is an OpenCypher query executed against FalkorDB."*

### ⏱️ 0:30 – 1:00 · Multi-Hop Incident Traversal & Decision Path ("Path Behind an Answer")
- **Visual**:
  1. Click the first preset button: `"504 Gateway Timeout Spike"` on `Payment-Gateway`.
  2. Click **"Dispatch Multi-Agent Incident Swarm"**.
  3. Watch the 3-Agent Stepper populate and the **"Path Behind the Answer" Decision Trace Banner** appear.
- **Speech**:
  > *"Let's simulate a live production outage: 504 timeouts on `Payment-Gateway`. Watch our swarm activate:*
  >
  > *First, **agent-triage** runs a multi-hop dependency query in FalkorDB, discovering 5 downstream services and computing the blast radius. It writes a `:TaskState` node and creates a `[:HANDED_OFF_TO]` edge.*
  >
  > *Second, **agent-investigator** queries FalkorDB for that incoming handoff, then searches cross-session episodic memory. It connects this 504 spike to past incident `ep-101`, proving the real root cause is connection pool exhaustion in `Ledger-DB`!*
  >
  > *Notice our Decision Trace Banner: it shows judges the exact causal graph chain from symptom to resolution."*

### ⏱️ 1:00 – 1:35 · Procedural Runbook Selection & Self-Learning Weight Mutation
- **Visual**:
  1. Scroll to the **Procedural Memory & Self-Learning Feedback Loop** section.
  2. Point out `proc-drain-ledger-pool` (88% confidence) vs `proc-restart-gw` (17% confidence).
  3. Click **"Mark SUCCESS (+Weight)"** on `proc-drain-ledger-pool`.
  4. Point to the instant toast notification and the weight bar updating.
- **Speech**:
  > *Third, **agent-commander** queries procedural memory in FalkorDB. It selects `proc-drain-ledger-pool` with 88% confidence and rejects blind pod restart, which historically failed.*
  >
  > *Now watch our self-learning procedural memory in action: when our SRE confirms resolution by clicking 'Mark SUCCESS', SynapseOps executes an OpenCypher mutation on the `[:LED_TO_RESOLUTION]` edge in FalkorDB. It updates the empirical weight and writes a new `:Episode` node so future sessions learn from this outcome."*

### ⏱️ 1:35 – 2:05 · Interactive Cognitive Graph Canvas & Cross-Session Recall
- **Visual**:
  1. Point to the **Interactive Cognitive Graph Canvas**. Click the **"Reasoning Path Only"** toggle to show the active glow.
  2. Click on a node (e.g., `Payment-Gateway` or `proc-drain-ledger-pool`) to open the **FalkorDB Node Inspector Drawer**.
  3. Click **"+ New Session"**, enter a new alert, and show how the investigator recalls the newly recorded episode from the prior session!
- **Speech**:
  > *"Our zero-dependency Cognitive Graph Canvas visualizes all 4 layers: Semantic in cyan, Episodic in purple, Procedural in green, and Agent Coordination in amber. We can filter to the active reasoning path, drag nodes, and inspect real-time FalkorDB properties.*
  >
  > *When we start a new session, the investigator queries FalkorDB and immediately recalls the incident from our previous session—proving persistent cross-session memory."*

### ⏱️ 2:05 – 2:30 · High-Concurrency Benchmark & Multi-Tenant Isolation
- **Visual**:
  1. Click **"Run Benchmark (24x Parallel)"** in the top navigation bar.
  2. The drawer slides open showing 600+ ops/sec and 100% tenant isolation.
  3. Toggle the tenant switcher to `nebula-cloud` to show isolated cloud topology.
- **Speech**:
  > *"Finally, for Track 2's high-concurrency requirement, watch our built-in benchmark engine run 24 parallel read and write operations across both `acme-fintech` and `nebula-cloud`. FalkorDB delivers over 600 ops per second with sub-40ms latency and 100% verified tenant isolation.*
  >
  > *SynapseOps turns FalkorDB into a living, learning brain for enterprise multi-agent operations. Thank you!"*

---

## 🏛️ Rule 12 Technical Architecture & Code Walkthrough

When judges inspect the codebase or ask technical questions, use this reference:

### 1. `src/lib/falkordb.ts` — The Official Client & Telemetry Wrapper
- **Singleton Pattern**: Connects via `FalkorDB.connect({ socket: { host, port } })` using the official `falkordb` npm package.
- **Multi-Tenant Isolation**: `getTenantGraph(tenantId)` calls `db.selectGraph('synapse_tenant_' + tenantId)`. Every tenant gets an isolated graph namespace inside FalkorDB.
- **Telemetry Buffer**: `executeWriteQuery` and `executeReadQuery` instrument latency with `performance.now()`, appending the Cypher statement, latency, parameters, and timestamp to a 50-entry circular buffer rendered live in the UI.

### 2. `src/lib/schema.ts` — 4-Layer Cognitive Graph Ontology
- **Semantic Memory**: Microservices (`:Service`), dependencies (`[:DEPENDS_ON {criticality, protocol}]`), and team ownership (`[:OWNS]`).
- **Episodic Memory**: Incidents across sessions (`:Session`, `:Turn`, `:Episode`) linked via `[:AFFECTED]` and `[:RECORDED_EPISODE]`.
- **Procedural Memory**: Playbooks (`:Procedure`) and ordered steps (`:Step`) linked via `[:LED_TO_RESOLUTION {success_count, fail_count, confidence_weight}]`.
- **Agent Coordination**: Shared task states (`:TaskState`) linked via `[:CREATED_STATE]` and directed delegation edges (`[:HANDED_OFF_TO {reason, stage, timestamp}]`).
- **Idempotent Indexes**: Schema helper initializes Cypher indexes on all primary node keys.

### 3. `src/lib/memory-engine.ts` — Graph Traversal & Learning Logic
- **`queryServiceBlastRadius`**: Traverses downstream dependencies up to 3 hops (`[:DEPENDS_ON*1..3]`), impacted callers, and executes `shortestPath` to the deepest critical dependency.
- **`recallEpisodicMemory`**: Recalls past episodes connected across the dependency subtree (`[:DEPENDS_ON*0..2]`), ordered by `ep.timestamp DESC`.
- **`writeAgentHandoff` & `readIncomingHandoff`**: Persists task state in FalkorDB and queries it for receiving agents, satisfying Rule 3.
- **`mutateProceduralMemory`**: Updates all resolution edges for a procedure using the empirical ratio formula with safe division, and creates a new `:Episode` node.

### 4. `src/lib/agent-swarm.ts` — 3-Agent Swarm Orchestrator
- **Stage 1 (`agent-triage`)**: Computes blast radius $\rightarrow$ writes `:TaskState` in FalkorDB $\rightarrow$ hands off to `agent-investigator`.
- **Stage 2 (`agent-investigator`)**: Reads FalkorDB handoff $\rightarrow$ recalls episodic memory $\rightarrow$ isolates root cause $\rightarrow$ hands off to `agent-commander`.
- **Stage 3 (`agent-commander`)**: Reads FalkorDB handoff $\rightarrow$ ranks procedural playbooks by confidence weight $\rightarrow$ finalizes state as `AWAITING_REMEDIATION_FEEDBACK`.
- **LLM / Deterministic Fallback**: Uses `@google/genai` (`gemini-2.5-flash`) when an API key is available, and an automatic deterministic graph-driven synthesis fallback when running offline.

### 5. `src/app/api/graph/benchmark/route.ts` — Concurrency Engine
- Executes 24 concurrent operations via `Promise.all` across both tenant graphs.
- Computes throughput (ops/sec), p95 latency, average latency, and programmatically asserts that queries targeted at `acme-fintech` never returned nodes belonging to `nebula-cloud` (100% isolation verification).
