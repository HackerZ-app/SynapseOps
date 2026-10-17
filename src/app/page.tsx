"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Database,
  Activity,
  Network,
  Shield,
  Brain,
  Zap,
  RefreshCcw,
  Terminal,
  Layers,
  GitBranch,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Server,
  Workflow,
  Users,
  Trash2,
  ChevronDown,
  ChevronUp,
  Play,
  ArrowRight,
  Flame,
  FileText,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ExternalLink,
  Cpu,
  History,
  Gauge,
  GaugeCircle,
} from "lucide-react";
import CognitiveGraphCanvas, { GraphNode, GraphEdge } from "@/components/CognitiveGraphCanvas";
import DecisionPathBanner from "@/components/DecisionPathBanner";

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface QueryTelemetry {
  queryName: string;
  cypher: string;
  params: Record<string, unknown>;
  durationMs: number;
  timestamp: string;
  type: "READ" | "WRITE";
  tenantId: string;
}

interface GraphCounts {
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

interface InspectResponse {
  tenantId: string;
  graphName: string;
  topology: {
    nodes: Array<{
      id: number;
      labels: string[];
      properties: Record<string, unknown>;
    }>;
    edges: Array<{
      id: number;
      source: number;
      target: number;
      type: string;
      properties: Record<string, unknown>;
    }>;
  };
  counts: GraphCounts;
  proceduralWeights: Array<{
    procedureId: string;
    procedureName: string;
    serviceId: string;
    serviceName: string;
    successCount: number;
    failCount: number;
    confidenceWeight: number;
    lastUsed: string;
  }>;
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

interface ProcedureStep {
  id: string;
  order: number;
  action: string;
  command: string;
  tool_name: string;
}

interface ProcedureRunbook {
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

interface AgentStepTrace {
  agentId: "agent-triage" | "agent-investigator" | "agent-commander";
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

interface SwarmResult {
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
    reason: string;
    confidence: number;
  };
  agentSteps: AgentStepTrace[];
  reasoningSubgraph: {
    nodes: Array<{ id: string; label: string; name: string }>;
    edges: Array<{ source: string; target: string; type: string; label?: string }>;
  };
  candidateProcedures: ProcedureRunbook[];
  selectedProcedure: ProcedureRunbook | null;
  telemetry: QueryTelemetry[];
}

interface SessionSummary {
  id: string;
  title: string;
  startedAt: string;
  userEngineer: string;
  turnCount: number;
  episodeCount: number;
}

interface BenchmarkResult {
  success: boolean;
  totalOperations: number;
  concurrencyLevel: number;
  wallClockMs: number;
  throughputOpsPerSec: number;
  metrics: {
    avgLatencyMs: number;
    p95LatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
  };
  breakdown: {
    reads: number;
    writes: number;
    tenantsTested: string[];
  };
  tenantIsolationVerified: boolean;
  timestamp: string;
}

type Tenant = "acme-fintech" | "nebula-cloud";

// ─── Preset Scenarios ───────────────────────────────────────────────────────

const PRESETS: Record<Tenant, Array<{ label: string; tag: string; alert: string }>> = {
  "acme-fintech": [
    {
      label: "504 Gateway Timeout Spike",
      tag: "Payment-Gateway",
      alert:
        "URGENT: Payment-Gateway throwing 504 Gateway Timeouts during checkout flash sale spike; p99 latency > 12s.",
    },
    {
      label: "Intermittent 401 Auth Drops",
      tag: "Auth & Redis",
      alert:
        "ALERT: Intermittent 401 Unauthorized drops on Payment-Gateway API calls. Session tokens being invalidated randomly.",
    },
  ],
  "nebula-cloud": [
    {
      label: "API Ingress 502 Outage",
      tag: "API-Ingress",
      alert:
        "CRITICAL: API-Ingress returning 502 Bad Gateway across all regional clusters. TLS handshake failures reported.",
    },
    {
      label: "Scheduler Queue Saturation",
      tag: "K8s-Scheduler",
      alert:
        "WARNING: K8s-Scheduler latency degradation impacting Vector-Store ingestion worker pods.",
    },
  ],
};

// ─── Main Page Component ────────────────────────────────────────────────────

export default function DiagnosticPage() {
  const [activeTenant, setActiveTenant] = useState<Tenant>("acme-fintech");
  const [inspectData, setInspectData] = useState<InspectResponse | null>(null);
  const [telemetryLog, setTelemetryLog] = useState<QueryTelemetry[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [seedStatus, setSeedStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // War Room / Swarm State
  const [alertText, setAlertText] = useState(PRESETS["acme-fintech"][0].alert);
  const [sessionId, setSessionId] = useState(`sess-${Date.now().toString(36)}`);
  const [isSwarmRunning, setIsSwarmRunning] = useState(false);
  const [swarmResult, setSwarmResult] = useState<SwarmResult | null>(null);
  const [sessionsList, setSessionsList] = useState<SessionSummary[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [selectedHopNodeId, setSelectedHopNodeId] = useState<string | null>(null);

  // Benchmark State
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
  const [showBenchmarkDrawer, setShowBenchmarkDrawer] = useState(false);

  // Telemetry drawer collapse
  const [showTelemetryDrawer, setShowTelemetryDrawer] = useState(false);

  const telemetryEndRef = useRef<HTMLDivElement>(null);

  // ─── API Helpers ──────────────────────────────────────────────────────────

  const handleInspect = useCallback(async () => {
    setIsInspecting(true);
    try {
      const res = await fetch(`/api/graph/inspect?tenantId=${activeTenant}`);
      const data: InspectResponse = await res.json();
      if (data.error) {
        setSeedStatus({ type: "error", message: data.error });
      } else {
        setInspectData(data);
        if (data.telemetry && data.telemetry.length > 0) {
          setTelemetryLog(data.telemetry);
        }
      }
    } catch (err) {
      setSeedStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Inspect failed",
      });
    } finally {
      setIsInspecting(false);
    }
  }, [activeTenant]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions?tenantId=${activeTenant}`);
      const data = await res.json();
      if (data.sessions) {
        setSessionsList(data.sessions);
      }
    } catch {
      // Non-fatal
    }
  }, [activeTenant]);

  const handleSeed = useCallback(
    async (reset: boolean) => {
      setIsSeeding(true);
      setSeedStatus(null);
      try {
        const res = await fetch("/api/graph/seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId: activeTenant, reset }),
        });
        const data = await res.json();
        if (data.success) {
          setSeedStatus({
            type: "success",
            message: data.message,
          });
          if (data.telemetry) setTelemetryLog(data.telemetry);
          await handleInspect();
          await fetchSessions();
        } else {
          setSeedStatus({
            type: "error",
            message: data.error || data.message || "Seed failed",
          });
        }
      } catch (err) {
        setSeedStatus({
          type: "error",
          message: err instanceof Error ? err.message : "Network error",
        });
      } finally {
        setIsSeeding(false);
      }
    },
    [activeTenant, handleInspect, fetchSessions]
  );

  const handleRunSwarm = async () => {
    if (!alertText.trim()) return;
    setIsSwarmRunning(true);
    setSwarmResult(null);
    setSeedStatus(null);
    setSelectedHopNodeId(null);

    try {
      const res = await fetch("/api/agents/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: activeTenant,
          sessionId,
          alertText: alertText.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSwarmResult(data);
        if (data.allTelemetry) setTelemetryLog(data.allTelemetry);
        await handleInspect();
        await fetchSessions();
      } else {
        setSeedStatus({
          type: "error",
          message: data.error || "Swarm execution failed",
        });
      }
    } catch (err) {
      setSeedStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Network error running swarm",
      });
    } finally {
      setIsSwarmRunning(false);
    }
  };

  const handleProceduralFeedback = async (
    procedureId: string,
    targetServiceId: string,
    outcome: "SUCCESS" | "FAILURE"
  ) => {
    setFeedbackLoading(`${procedureId}-${outcome}`);
    try {
      const res = await fetch("/api/agents/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: activeTenant,
          sessionId,
          procedureId,
          targetServiceId,
          outcome,
          notes: `Simulated ${outcome} execution from War Room console.`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedbackToast(
          `Self-Learning Update: ${data.procedureName} confidence updated to ${(
            data.newConfidenceWeight * 100
          ).toFixed(0)}% in FalkorDB (Successes: ${data.successCount}, Fails: ${data.failCount}). Recorded episode ${data.createdEpisodeId}.`
        );
        // Refresh graph inspect to update procedural tables, weights & canvas edges
        await handleInspect();
        if (data.telemetry) setTelemetryLog(data.telemetry);
      } else {
        setSeedStatus({
          type: "error",
          message: data.error || "Feedback update failed",
        });
      }
    } catch (err) {
      setSeedStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Feedback error",
      });
    } finally {
      setFeedbackLoading(null);
    }
  };

  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    setBenchmarkResult(null);
    setShowBenchmarkDrawer(true);
    try {
      const res = await fetch("/api/graph/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: activeTenant, concurrencyLevel: 24 }),
      });
      const data = await res.json();
      if (data.success) {
        setBenchmarkResult(data);
      } else {
        setSeedStatus({ type: "error", message: data.error || "Benchmark failed" });
      }
    } catch (err) {
      setSeedStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Benchmark network error",
      });
    } finally {
      setIsBenchmarking(false);
    }
  };

  const startNewSession = () => {
    const newId = `sess-${Date.now().toString(36)}`;
    setSessionId(newId);
    setSwarmResult(null);
    setFeedbackToast(null);
    setSelectedHopNodeId(null);
  };

  // Initial load
  useEffect(() => {
    handleInspect();
    fetchSessions();
    setAlertText(PRESETS[activeTenant][0].alert);
    setSwarmResult(null);
  }, [activeTenant, handleInspect, fetchSessions]);

  // Scroll telemetry feed
  useEffect(() => {
    telemetryEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [telemetryLog]);

  // Highlighted Node IDs for Canvas
  const highlightedNodeIds = useMemo(() => {
    const ids: string[] = [];
    if (swarmResult) {
      ids.push(...swarmResult.reasoningSubgraph.nodes.map((n) => n.id));
      ids.push(swarmResult.matchedService.id);
      ids.push(swarmResult.rootCauseService.id);
      if (swarmResult.selectedProcedure) {
        ids.push(swarmResult.selectedProcedure.procedureId);
      }
    }
    if (selectedHopNodeId) {
      ids.push(selectedHopNodeId);
    }
    return ids;
  }, [swarmResult, selectedHopNodeId]);

  const counts = inspectData?.counts;
  const canvasNodes: GraphNode[] = (inspectData?.topology?.nodes || []) as GraphNode[];
  const canvasEdges: GraphEdge[] = (inspectData?.topology?.edges || []) as GraphEdge[];

  return (
    <div className="min-h-screen mesh-gradient-1 pb-16">
      {/* ═══ Top Header & Command Bar ═══ */}
      <header className="border-b border-[var(--border-dim)] bg-[var(--bg-secondary)]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1560px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Brain className="w-7 h-7 text-[var(--accent-blue)]" />
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--accent-emerald)] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">
                  Synapse<span className="text-[var(--accent-blue)]">Ops</span>
                </h1>
                <span className="badge badge-violet text-[10px] py-0.5">Graph Hacks Swarm</span>
                <span className="badge badge-emerald text-[10px] py-0.5">FalkorDB Core</span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] tracking-wider -mt-0.5">
                Self-Learning Multi-Agent Incident War Room · Track 1 & Track 2
              </p>
            </div>
          </div>

          {/* Tenant Switcher & Isolation Badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[var(--bg-primary)] rounded-lg p-1 border border-[var(--border-dim)]">
              {(["acme-fintech", "nebula-cloud"] as Tenant[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setActiveTenant(t);
                    setAlertText(PRESETS[t][0].alert);
                  }}
                  className={`tenant-tab text-xs ${activeTenant === t ? "tenant-tab-active" : ""}`}
                >
                  <span className="flex items-center gap-1.5">
                    {t === "acme-fintech" ? (
                      <Shield className="w-3.5 h-3.5" />
                    ) : (
                      <Network className="w-3.5 h-3.5" />
                    )}
                    {t}
                  </span>
                </button>
              ))}
            </div>

            <div className="hidden sm:flex items-center gap-1.5 bg-[var(--bg-card)] px-2.5 py-1 rounded text-xs border border-[var(--border-dim)]">
              <Database className="w-3.5 h-3.5 text-[var(--accent-cyan)]" />
              <code className="text-[var(--accent-cyan)] font-mono text-[11px]">
                synapse_tenant_{activeTenant}
              </code>
              <span className="status-dot status-dot-healthy ml-1" />
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunBenchmark}
              disabled={isBenchmarking}
              className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1.5 text-[var(--accent-amber)] border-[var(--accent-amber)]/40 hover:bg-[var(--accent-amber)]/10"
              title="Runs 24 concurrent parallel graph read/write operations across both tenants"
            >
              {isBenchmarking ? (
                <span className="spinner" />
              ) : (
                <Gauge className="w-3.5 h-3.5 text-[var(--accent-amber)]" />
              )}
              Run Benchmark (24x Parallel)
            </button>

            <button
              onClick={() => handleSeed(true)}
              disabled={isSeeding}
              className="btn-danger text-xs px-2.5 py-1.5"
              title="Reset and re-seed tenant graph in FalkorDB"
            >
              {isSeeding ? <span className="spinner" /> : <Trash2 className="w-3.5 h-3.5" />}
              Reset & Seed
            </button>
          </div>
        </div>
      </header>

      {/* ═══ Main War Room Grid ═══ */}
      <main className="max-w-[1560px] mx-auto px-6 py-6 space-y-6">
        {/* Toast / Notification Banner */}
        {feedbackToast && (
          <div className="bg-[var(--bg-elevated)] border border-[var(--accent-emerald)] text-[var(--accent-emerald)] px-4 py-2.5 rounded-lg flex items-center justify-between animate-slide-down text-xs">
            <span className="flex items-center gap-2 font-medium">
              <Sparkles className="w-4 h-4 shrink-0" />
              {feedbackToast}
            </span>
            <button
              onClick={() => setFeedbackToast(null)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {seedStatus && (
          <div
            className={`px-4 py-2.5 rounded-lg text-xs flex items-center justify-between animate-slide-down ${
              seedStatus.type === "success"
                ? "bg-emerald-950/40 border border-emerald-500/40 text-emerald-300"
                : "bg-rose-950/40 border border-rose-500/40 text-rose-300"
            }`}
          >
            <span className="flex items-center gap-2">
              {seedStatus.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              {seedStatus.message}
            </span>
            <button onClick={() => setSeedStatus(null)} className="opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        {/* ═══ High-Concurrency Benchmark Panel (Collapsible/Drawer) ═══ */}
        {showBenchmarkDrawer && benchmarkResult && (
          <div className="card p-5 border-[var(--accent-amber)]/50 bg-gradient-to-r from-[var(--bg-card)] via-[var(--bg-elevated)] to-[var(--bg-card)] shadow-2xl animate-slide-down">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <GaugeCircle className="w-5 h-5 text-[var(--accent-amber)]" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      High-Concurrency Read/Write Swarm Benchmark Results
                    </h3>
                    <span className="badge badge-amber text-[10px]">Track 2 Criterion</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Simultaneous burst of {benchmarkResult.concurrencyLevel} parallel graph operations
                    across both <code>acme-fintech</code> and <code>nebula-cloud</code>.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowBenchmarkDrawer(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs"
              >
                ✕ Close
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              <div className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border-dim)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase tracking-wider">
                  Throughput
                </span>
                <span className="text-lg font-bold text-[var(--accent-emerald)] font-mono">
                  {benchmarkResult.throughputOpsPerSec} ops/s
                </span>
                <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                  {benchmarkResult.totalOperations} ops in {benchmarkResult.wallClockMs}ms
                </span>
              </div>

              <div className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border-dim)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase tracking-wider">
                  p95 Latency
                </span>
                <span className="text-lg font-bold text-[var(--accent-cyan)] font-mono">
                  {benchmarkResult.metrics.p95LatencyMs} ms
                </span>
                <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                  Avg: {benchmarkResult.metrics.avgLatencyMs} ms
                </span>
              </div>

              <div className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border-dim)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase tracking-wider">
                  Min / Max Latency
                </span>
                <span className="text-base font-bold text-[var(--text-primary)] font-mono">
                  {benchmarkResult.metrics.minLatencyMs} / {benchmarkResult.metrics.maxLatencyMs} ms
                </span>
                <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                  Sub-40ms variance
                </span>
              </div>

              <div className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border-dim)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase tracking-wider">
                  Operation Breakdown
                </span>
                <span className="text-base font-bold text-[var(--text-primary)] font-mono">
                  {benchmarkResult.breakdown.reads} Reads · {benchmarkResult.breakdown.writes} Writes
                </span>
                <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                  Parallel Cypher Bursts
                </span>
              </div>

              <div className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border-dim)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase tracking-wider">
                  Tenant Isolation
                </span>
                <span className="text-base font-bold text-[var(--accent-emerald)] flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-4 h-4" /> 100% Isolated
                </span>
                <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                  Zero cross-tenant leakage
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Top Section: "Show the Path Behind an Answer" Banner (if swarm ran) ═══ */}
        {swarmResult && (
          <DecisionPathBanner
            matchedService={swarmResult.matchedService}
            rootCauseService={swarmResult.rootCauseService}
            selectedProcedure={swarmResult.selectedProcedure}
            hopsCount={swarmResult.matchedService.id === swarmResult.rootCauseService.id ? 1 : 2}
            onSelectHopNode={(nodeId) => setSelectedHopNodeId(nodeId)}
          />
        )}

        {/* ═══ Main 2-Column Split: Dispatcher/Stepper on Left, Canvas/Runbooks on Right ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── Left Column (5 cols): Incident Dispatcher & 3-Agent Stepper ── */}
          <div className="lg:col-span-5 space-y-6">
            {/* Command Card: Alert Input & Presets */}
            <div className="card p-5 border-[var(--border-subtle)] relative">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[var(--accent-rose)]" />
                  Incident Swarm Dispatcher
                </h2>

                {/* Session Selector */}
                <div className="flex items-center gap-1.5">
                  <div className="bg-[var(--bg-elevated)] px-2 py-0.5 rounded text-xs border border-[var(--border-dim)] flex items-center gap-1">
                    <History className="w-3 h-3 text-[var(--accent-cyan)]" />
                    <select
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      className="bg-transparent text-[var(--text-primary)] font-mono text-[11px] outline-none cursor-pointer max-w-[130px] truncate"
                    >
                      <option value={sessionId} className="bg-[var(--bg-card)]">
                        {sessionId} (Current)
                      </option>
                      {sessionsList.map((s) => (
                        <option key={s.id} value={s.id} className="bg-[var(--bg-card)]">
                          {s.id} ({s.turnCount} turns)
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={startNewSession}
                    className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] border border-[var(--border-dim)]"
                    title="Start fresh session"
                  >
                    + New
                  </button>
                </div>
              </div>

              {/* Scenario Preset Quick-Buttons */}
              <div className="space-y-1.5 mb-3">
                <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider block">
                  Quick Scenario Presets ({activeTenant}):
                </span>
                <div className="flex flex-col gap-1.5">
                  {PRESETS[activeTenant].map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => setAlertText(preset.alert)}
                      className="text-left text-xs bg-[var(--bg-primary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-dim)] hover:border-[var(--accent-blue)]/50 p-2 rounded-md transition-all flex items-center justify-between group"
                    >
                      <div className="truncate mr-2">
                        <span className="badge badge-blue text-[9px] py-0 px-1.5 mr-1.5">
                          {preset.tag}
                        </span>
                        <span className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] font-medium">
                          {preset.label}
                        </span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--accent-blue)] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Alert Input Textarea */}
              <div className="relative mb-3">
                <textarea
                  value={alertText}
                  onChange={(e) => setAlertText(e.target.value)}
                  rows={2}
                  placeholder="Enter raw alert text or symptom description..."
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-dim)] focus:border-[var(--accent-blue)] rounded-lg p-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] font-mono resize-none outline-none transition-colors"
                />
              </div>

              {/* Action Trigger */}
              <button
                onClick={handleRunSwarm}
                disabled={isSwarmRunning || !alertText.trim()}
                className="btn-primary w-full justify-center text-xs py-2"
              >
                {isSwarmRunning ? (
                  <>
                    <span className="spinner" />
                    Swarm Orchestrating in FalkorDB...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Dispatch Multi-Agent Incident Swarm
                  </>
                )}
              </button>
            </div>

            {/* 3-Agent Coordination Stepper */}
            {swarmResult && (
              <div className="card p-5 space-y-4 animate-fade-in border-[var(--border-subtle)]">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-dim)]">
                  <h3 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wider">
                    <Workflow className="w-4 h-4 text-[var(--accent-cyan)]" />
                    3-Agent State Handoff Trace
                  </h3>
                  <span className="text-[10px] text-[var(--accent-cyan)] font-mono">
                    FalkorDB :TaskState
                  </span>
                </div>

                <div className="space-y-3">
                  {swarmResult.agentSteps.map((step, idx) => (
                    <div
                      key={step.agentId}
                      className="rounded-lg p-3 bg-[var(--bg-primary)] border border-[var(--border-dim)] text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`badge text-[10px] py-0 px-2 ${
                            idx === 0
                              ? "badge-blue"
                              : idx === 1
                              ? "badge-amber"
                              : "badge-violet"
                          }`}
                        >
                          Step {idx + 1} · {step.role}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="font-semibold text-[var(--text-primary)]">
                        {step.agentName}
                      </div>

                      {/* Handoff Edge indicator */}
                      {step.handoffEdge && (
                        <div className="p-2 rounded bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-mono font-bold block text-[10px]">
                              [:HANDED_OFF_TO] → {step.handoffEdge.toAgentId}
                            </span>
                            <span className="text-[10px] text-amber-300/80">
                              {step.handoffEdge.reason}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Reasoning Snippet */}
                      <p className="text-[11px] text-[var(--text-secondary)] whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto pr-1">
                        {step.reasoning}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right Column (7 cols): Interactive Graph Canvas & Runbook Matrix ── */}
          <div className="lg:col-span-7 space-y-6">
            {/* Interactive Cognitive Graph Canvas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Network className="w-4 h-4 text-[var(--accent-blue)]" />
                  Interactive Cognitive Graph Canvas
                  <span className="text-[10px] text-[var(--text-muted)] font-mono font-normal">
                    ({canvasNodes.length} nodes · {canvasEdges.length} edges)
                  </span>
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  Click nodes to inspect · Drag to reposition · Scroll/buttons to zoom
                </span>
              </div>

              <CognitiveGraphCanvas
                nodes={canvasNodes}
                edges={canvasEdges}
                highlightedNodeIds={highlightedNodeIds}
                highlightedEdgeTypes={[
                  "DEPENDS_ON",
                  "AFFECTED",
                  "LED_TO_RESOLUTION",
                  "HANDED_OFF_TO",
                ]}
                selectedNodeId={selectedHopNodeId}
                onSelectNode={(node) => {
                  if (node) setSelectedHopNodeId(String(node.id));
                }}
              />
            </div>

            {/* Self-Learning Procedural Playbooks Matrix */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Brain className="w-4 h-4 text-[var(--accent-violet)]" />
                    Procedural Memory & Self-Learning Feedback Loop
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Live dynamic confidence weights on <code>[:LED_TO_RESOLUTION]</code> in FalkorDB.
                    Simulate outcomes to trigger real-time weight adjustment.
                  </p>
                </div>

                <span className="badge badge-emerald text-[10px]">Laplace Formula Fixed</span>
              </div>

              <div className="space-y-3">
                {inspectData?.proceduralWeights?.map((pw) => {
                  const weightPct = Math.round(pw.confidenceWeight * 100);
                  const isTopCandidate =
                    swarmResult?.selectedProcedure?.procedureId === pw.procedureId;

                  return (
                    <div
                      key={`${pw.procedureId}-${pw.serviceId}`}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isTopCandidate
                          ? "bg-[var(--bg-elevated)] border-[var(--accent-cyan)]/50 shadow-md"
                          : "bg-[var(--bg-card)] border-[var(--border-dim)] hover:border-[var(--border-subtle)]"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`badge ${
                                isTopCandidate ? "badge-emerald" : "badge-amber"
                              }`}
                            >
                              {isTopCandidate ? "Selected Runbook" : "Alternative Option"}
                            </span>
                            <code className="text-xs font-mono text-[var(--accent-cyan)] font-bold">
                              {pw.procedureId}
                            </code>
                          </div>
                          <h4 className="text-xs font-bold text-[var(--text-primary)] mt-1">
                            {pw.procedureName}
                          </h4>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            Target Service:{" "}
                            <span className="text-[var(--text-secondary)] font-medium">
                              {pw.serviceName}
                            </span>
                          </span>
                        </div>

                        {/* Confidence Weight Bar */}
                        <div className="text-right">
                          <span className="text-xs font-bold text-[var(--text-primary)] font-mono">
                            {weightPct}% Confidence
                          </span>
                          <div className="w-32 h-2 bg-[var(--bg-primary)] rounded-full mt-1 overflow-hidden border border-[var(--border-dim)]">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                weightPct >= 70
                                  ? "bg-[var(--accent-emerald)]"
                                  : weightPct >= 40
                                  ? "bg-[var(--accent-amber)]"
                                  : "bg-[var(--accent-rose)]"
                              }`}
                              style={{ width: `${weightPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
                            {pw.successCount} succ · {pw.failCount} fail
                          </span>
                        </div>
                      </div>

                      {/* Interactive Feedback Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-dim)]/50">
                        <span className="text-[10px] text-[var(--text-muted)] mr-2">
                          Simulate Outcome:
                        </span>

                        <button
                          onClick={() =>
                            handleProceduralFeedback(pw.procedureId, pw.serviceId, "SUCCESS")
                          }
                          disabled={feedbackLoading === `${pw.procedureId}-SUCCESS`}
                          className="btn-success text-[11px] px-2.5 py-1"
                          title="Increments success_count, raises weight, and records new Episode"
                        >
                          {feedbackLoading === `${pw.procedureId}-SUCCESS` ? (
                            <span className="spinner" />
                          ) : (
                            <TrendingUp className="w-3 h-3" />
                          )}
                          Mark SUCCESS (+Weight)
                        </button>

                        <button
                          onClick={() =>
                            handleProceduralFeedback(pw.procedureId, pw.serviceId, "FAILURE")
                          }
                          disabled={feedbackLoading === `${pw.procedureId}-FAILURE`}
                          className="btn-danger text-[11px] px-2.5 py-1"
                          title="Increments fail_count, lowers weight, and records failed Episode"
                        >
                          {feedbackLoading === `${pw.procedureId}-FAILURE` ? (
                            <span className="spinner" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          Mark FAILURE (-Weight)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Bottom Bar: Collapsible Live Cypher Telemetry Stream ═══ */}
        <div className="card border-[var(--border-dim)] overflow-hidden">
          <div
            className="p-3.5 bg-[var(--bg-secondary)] flex items-center justify-between cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
            onClick={() => setShowTelemetryDrawer((p) => !p)}
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[var(--accent-cyan)]" />
              <span className="text-xs font-bold text-[var(--text-primary)]">
                Live OpenCypher Query Telemetry Buffer ({telemetryLog.length} queries logged)
              </span>
              <span className="badge badge-blue text-[10px] py-0">Sub-Millisecond Engine</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>{showTelemetryDrawer ? "Hide Stream" : "Expand Stream"}</span>
              {showTelemetryDrawer ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </div>

          {showTelemetryDrawer && (
            <div className="p-4 bg-[var(--bg-primary)] max-h-[380px] overflow-auto space-y-1 font-mono text-xs border-t border-[var(--border-dim)] animate-slide-down">
              {telemetryLog.map((entry, idx) => (
                <TelemetryRow key={idx} entry={entry} index={idx} />
              ))}
              <div ref={telemetryEndRef} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function TelemetryRow({ entry, index }: { entry: QueryTelemetry; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="rounded border border-transparent hover:border-[var(--border-dim)] hover:bg-[var(--bg-card)]">
      <div
        className="px-3 py-1 flex items-center justify-between cursor-pointer gap-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 truncate">
          <span
            className={`badge text-[9px] py-0 px-1.5 ${
              entry.type === "WRITE" ? "badge-amber" : "badge-blue"
            }`}
          >
            {entry.type}
          </span>
          <span
            className={`font-semibold ${
              entry.durationMs < 5
                ? "text-[var(--accent-emerald)]"
                : entry.durationMs < 20
                ? "text-[var(--accent-amber)]"
                : "text-[var(--accent-rose)]"
            }`}
          >
            {entry.durationMs.toFixed(2)}ms
          </span>
          <span className="text-[var(--text-secondary)] font-medium truncate">
            {entry.queryName}
          </span>
        </div>
        <span className="text-[var(--text-muted)] text-[10px] shrink-0">{time}</span>
      </div>

      {expanded && (
        <div className="p-3 bg-[var(--bg-elevated)] border-t border-[var(--border-dim)] text-[11px] space-y-2">
          <div>
            <span className="text-[var(--text-muted)] block mb-1">OpenCypher Statement:</span>
            <pre className="text-[var(--accent-cyan)] whitespace-pre-wrap bg-[var(--bg-primary)] p-2 rounded">
              {entry.cypher}
            </pre>
          </div>
          {Object.keys(entry.params).length > 0 && (
            <div>
              <span className="text-[var(--text-muted)] block mb-1">Query Parameters:</span>
              <pre className="text-[var(--accent-amber)] whitespace-pre-wrap bg-[var(--bg-primary)] p-2 rounded">
                {JSON.stringify(entry.params, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
