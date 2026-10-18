/**
 * SynapseOps — Shared Frontend Types & Incident Presets
 */

import { GraphNode, GraphEdge } from '@/components/CognitiveGraphCanvas';

export type Tenant = 'acme-fintech' | 'nebula-cloud';

export interface QueryTelemetry {
  queryName: string;
  cypher: string;
  params: Record<string, unknown>;
  durationMs: number;
  timestamp: string;
  type: 'READ' | 'WRITE';
  tenantId: string;
}

export interface GraphCounts {
  services: number;
  episodes: number;
  procedures: number;
  agents: number;
  taskStates: number;
  sessions: number;
  turns: number;
  steps: number;
  teams: number;
}

export interface ProceduralWeightItem {
  procedureId: string;
  procedureName: string;
  serviceId: string;
  serviceName: string;
  successCount: number;
  failCount: number;
  confidenceWeight: number;
  lastUsed: string;
}

export interface DeduplicatedProcedure {
  procedureId: string;
  procedureName: string;
  primaryServiceId: string;
  targetServices: Array<{ serviceId: string; serviceName: string }>;
  successCount: number;
  failCount: number;
  confidenceWeight: number;
  lastUsed: string;
}

export interface InspectResponse {
  tenantId: string;
  graphName: string;
  topology: {
    nodes: Array<{
      id: number | string;
      labels: string[];
      properties: Record<string, unknown>;
    }>;
    edges: Array<{
      id: number | string;
      source: number | string;
      target: number | string;
      type: string;
      properties: Record<string, unknown>;
    }>;
  };
  counts: GraphCounts;
  proceduralWeights: ProceduralWeightItem[];
  serviceTopology: Array<{
    sourceId: string;
    sourceName: string;
    targetId: string;
    targetName: string;
    criticality: string;
    protocol: string;
  }>;
  agentHandoffs: Array<{
    taskStateId: string;
    taskStatus: string;
    agentId: string;
    agentName: string;
    reason: string;
    timestamp: string;
  }>;
  telemetry: QueryTelemetry[];
  error?: string;
}

export interface ProcedureStep {
  id: string;
  order: number;
  action: string;
  command: string;
  tool_name: string;
}

export interface ProcedureRunbook {
  procedureId: string;
  name: string;
  symptomPattern: string;
  targetServiceId: string;
  targetServiceName: string;
  successCount: number;
  failCount: number;
  confidenceWeight: number;
  lastUsed: string;
  steps: ProcedureStep[];
}

export interface AgentStepTrace {
  agentId: 'agent-triage' | 'agent-investigator' | 'agent-commander';
  agentName: string;
  role: string;
  stage: string;
  timestamp: string;
  falkordbQueriesRun: string[];
  graphStateInput?: Record<string, unknown>;
  graphStateOutput?: Record<string, unknown>;
  handoffEdge?: {
    toAgentId: string;
    reason: string;
    contextSummary: string;
  };
  reasoning: string;
}

export interface SwarmResult {
  sessionId: string;
  taskId: string;
  alertText: string;
  tenantId: string;
  matchedService: {
    id: string;
    name: string;
    tier: string;
    ownerTeam: string;
  };
  rootCauseService: {
    id: string;
    name: string;
    tier: string;
    ownerTeam: string;
  };
  selectedProcedure: ProcedureRunbook | null;
  agentSteps: AgentStepTrace[];
  reasoningSubgraph: {
    nodes: Array<{ id: string; name: string; type: string }>;
    edges: Array<{ source: string; target: string; type: string }>;
  };
  summaryReport: string;
  handoffEdgesCreated: number;
  executionTimeMs: number;
  allTelemetry?: QueryTelemetry[];
}

export interface BenchmarkResult {
  concurrencyLevel: number;
  totalOperations: number;
  wallClockMs: number;
  throughputOpsPerSec: number;
  metrics: {
    minLatencyMs: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    maxLatencyMs: number;
  };
  breakdown: {
    reads: number;
    writes: number;
    perTenant: Record<string, { reads: number; writes: number; avgLatencyMs: number }>;
  };
  telemetry: QueryTelemetry[];
}

export interface SessionSummary {
  id: string;
  startedAt: string;
  userEngineer: string;
  turnCount: number;
  lastActive?: string;
}

export interface ScenarioPreset {
  label: string;
  tag: string;
  alert: string;
}

export const PRESETS: Record<Tenant, ScenarioPreset[]> = {
  'acme-fintech': [
    {
      label: 'Payment-Gateway 504 Timeout Spike',
      tag: 'Critical · Tier-1',
      alert:
        'HTTP 504 Gateway Timeout spike (>15% errors) detected on Payment-Gateway. Downstream Ledger-DB connection pool exhausted. Check pool drain runbook.',
    },
    {
      label: 'Intermittent 401 Auth Drops',
      tag: 'Security · Tier-1',
      alert:
        'Auth-Service JWT validation cache miss rate spiked to 92%. User sessions failing randomly across web clients.',
    },
    {
      label: 'API-Ingress 502 Bad Gateway',
      tag: 'Edge · Ingress',
      alert:
        'API-Ingress Envoy proxy reporting 502 Bad Gateway. Upstream Payment-Gateway and Auth-Service health checks failing.',
    },
  ],
  'nebula-cloud': [
    {
      label: 'Compute-Orchestrator Node Allocation Failure',
      tag: 'Core Platform',
      alert:
        'Compute-Orchestrator failed to allocate GPU worker nodes for job tenant-job-994. State-Store etcd lease expired.',
    },
    {
      label: 'Object-Storage Bucket Quota Degradation',
      tag: 'Storage · Tier-2',
      alert:
        'Object-Storage metadata sync latency increased from 4ms to 380ms. Replication queue backpressure detected.',
    },
    {
      label: 'VPC-Router Packet Drop Surge',
      tag: 'Networking',
      alert:
        'VPC-Router East-West mesh dropping 8% of inter-service gRPC packets. BGP route flapping suspected.',
    },
  ],
};
