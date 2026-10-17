/**
 * SynapseOps — Unified Cognitive Graph Data Model & Schema Initialization
 *
 * 4-Layer Architecture:
 *   1. Semantic Memory   — Infrastructure topology & service dependencies
 *   2. Episodic Memory   — Persistent cross-session incident history
 *   3. Procedural Memory — Self-learning runbooks with dynamic confidence weights
 *   4. Agent Coordination — Multi-agent handoff & shared task state
 *
 * All data lives in FalkorDB. Each layer is defined by TypeScript interfaces
 * and initialised with Cypher index creation helpers.
 */

import { executeWriteQuery } from './falkordb';

// ═══════════════════════════════════════════════════════════════════════════
// 1. SEMANTIC MEMORY — Infrastructure & Topology
// ═══════════════════════════════════════════════════════════════════════════

export interface Service {
  id: string;
  name: string;
  tier: 'critical' | 'standard' | 'auxiliary';
  owner_team: string;
  language: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
}

export interface ServiceDependency {
  criticality: 'hard' | 'soft';
  protocol: string;
}

export interface Team {
  id: string;
  name: string;
  oncall_channel: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. EPISODIC MEMORY — Persistent Cross-Session Incident History
// ═══════════════════════════════════════════════════════════════════════════

export interface Session {
  id: string;
  title: string;
  started_at: string;
  user_engineer: string;
}

export interface Turn {
  id: string;
  role: 'user' | 'agent-triage' | 'agent-investigator' | 'agent-commander' | 'system';
  content: string;
  timestamp: string;
}

export interface Episode {
  id: string;
  session_id: string;
  symptom: string;
  root_cause: string;
  summary: string;
  resolved: boolean;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. PROCEDURAL MEMORY — Self-Learning Runbooks & Dynamic Edge Weights
// ═══════════════════════════════════════════════════════════════════════════

export interface Procedure {
  id: string;
  name: string;
  symptom_pattern: string;
  target_service_id: string;
}

export interface Step {
  id: string;
  order: number;
  action: string;
  command: string;
  tool_name: string;
}

export interface LedToResolution {
  success_count: number;
  fail_count: number;
  confidence_weight: number;
  last_used: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. AGENT COORDINATION — Multi-Agent Handoff & Shared Task State
// ═══════════════════════════════════════════════════════════════════════════

export interface Agent {
  id: string;
  name: string;
  role: string;
  specialty: string;
}

export interface TaskState {
  id: string;
  session_id: string;
  status: 'pending' | 'investigating' | 'executing' | 'resolved' | 'escalated';
  hypothesis: string;
  blast_radius_json: string;
  selected_procedure_id: string;
  updated_at: string;
}

export interface HandoffEdge {
  reason: string;
  context_summary: string;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA INDEX INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

const INDEX_QUERIES: { name: string; cypher: string }[] = [
  // Semantic Memory Indexes
  { name: 'idx-service-id', cypher: 'CREATE INDEX FOR (s:Service) ON (s.id)' },
  { name: 'idx-team-id', cypher: 'CREATE INDEX FOR (t:Team) ON (t.id)' },

  // Episodic Memory Indexes
  { name: 'idx-session-id', cypher: 'CREATE INDEX FOR (sess:Session) ON (sess.id)' },
  { name: 'idx-turn-id', cypher: 'CREATE INDEX FOR (turn:Turn) ON (turn.id)' },
  { name: 'idx-episode-id', cypher: 'CREATE INDEX FOR (ep:Episode) ON (ep.id)' },

  // Procedural Memory Indexes
  { name: 'idx-procedure-id', cypher: 'CREATE INDEX FOR (p:Procedure) ON (p.id)' },
  { name: 'idx-step-id', cypher: 'CREATE INDEX FOR (st:Step) ON (st.id)' },

  // Agent Coordination Indexes
  { name: 'idx-agent-id', cypher: 'CREATE INDEX FOR (a:Agent) ON (a.id)' },
  { name: 'idx-taskstate-id', cypher: 'CREATE INDEX FOR (ts:TaskState) ON (ts.id)' },
];

/**
 * Initialise FalkorDB indexes for the tenant graph.
 * Indexes are idempotent — safe to call on every seed.
 */
export async function initializeSchemaIndexes(tenantId: string): Promise<void> {
  for (const idx of INDEX_QUERIES) {
    try {
      await executeWriteQuery(tenantId, `schema:${idx.name}`, idx.cypher);
    } catch (err: unknown) {
      // Index may already exist — FalkorDB throws if duplicate
      const message = err instanceof Error ? err.message : String(err);
      if (!message.toLowerCase().includes('already') && !message.toLowerCase().includes('exists')) {
        console.warn(`[schema] Index ${idx.name} warning: ${message}`);
      }
    }
  }
}
