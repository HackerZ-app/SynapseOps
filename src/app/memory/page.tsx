"use client";

import React, { useState, useEffect } from "react";
import {
  Brain,
  History,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Workflow,
  Sparkles,
  Users,
  Clock,
  Terminal,
  Layers,
  ArrowRight,
  Database,
  BookOpen,
} from "lucide-react";
import { useSynapse } from "@/context/SynapseContext";
import { DeduplicatedProcedure } from "@/types/synapse";

// Enterprise Ansible/Terraform-style playbook step definitions
const PROCEDURE_PLAYBOOKS_MAP: Record<
  string,
  Array<{ step: string; cmd: string }>
> = {
  "proc-drain-ledger-pool": [
    {
      step: "Inspect database pool saturation & thread starvation",
      cmd: "falkordb-cli -g $TENANT_GRAPH 'MATCH (db:Service {id: \"svc-ledger-db\"}) RETURN db.conn_pool_pct'",
    },
    {
      step: "Drain idle socket handles gracefully",
      cmd: "pg_drain_pool --host=ledger-db.internal --drain-timeout=5s --idle-only",
    },
    {
      step: "Verify p99 latency & thread recovery below threshold",
      cmd: "curl -s http://ledger-db.internal:9090/metrics | grep 'pool_wait_ms{quantile=\"0.99\"}'",
    },
  ],
  "proc-restart-auth-cache": [
    {
      step: "Check replica sync status on authentication cache",
      cmd: "redis-cli -h auth-cache.internal -p 6379 info replication",
    },
    {
      step: "Rolling restart of Auth-Service worker pods",
      cmd: "kubectl rollout restart deployment/auth-router -n production",
    },
    {
      step: "Warm cache with active JWT public key certificate set",
      cmd: "curl -X POST http://auth-router.internal:8080/internal/warmup",
    },
  ],
  "proc-scale-worker-pool": [
    {
      step: "Inspect queue depth & consumer lag across partitions",
      cmd: "kafka-consumer-groups --bootstrap-server kafka:9092 --describe --group payments",
    },
    {
      step: "Scale consumer deployment replicas +3 in cluster",
      cmd: "kubectl scale deployment/payment-consumer --replicas=6 -n production",
    },
    {
      step: "Verify consumer lag drops to zero within 15 seconds",
      cmd: "datadog-agent check kafka_consumer_lag --threshold 50",
    },
  ],
  "proc-reconnect-db": [
    {
      step: "Flush hung socket buffer on primary connection handle",
      cmd: "netstat -tnpa | grep ':5432' | awk '{print $7}' | cut -d/ -f1 | xargs -r kill -9",
    },
    {
      step: "Issue TCP reset to database replica cluster endpoint",
      cmd: "iptables -A INPUT -p tcp --dport 5432 -m state --state ESTABLISHED -j REJECT --reject-with tcp-reset",
    },
    {
      step: "Validate read replica synchronization & master lease",
      cmd: "falkordb-cli -g $TENANT_GRAPH 'MATCH (s:Service)-[r:DEPENDS_ON]->(db) RETURN s.name, r.status'",
    },
  ],
};

export default function MemoryHubPage() {
  const {
    tenantId,
    inspectData,
    deduplicatedProcedures,
    activeSessionId,
    setSessionId,
    sessionsList,
    submitFeedback,
    feedbackLoading,
    lastSwarmResult,
  } = useSynapse();

  const [selectedSessionForHistory, setSelectedSessionForHistory] =
    useState<string>(activeSessionId);
  const [sessionDetails, setSessionDetails] = useState<{
    turns: Array<{
      id: string;
      role: string;
      content: string;
      agentId: string;
      timestamp: string;
    }>;
    episodes: Array<{
      id: string;
      symptom: string;
      root_cause: string;
      summary: string;
      resolved: boolean;
      timestamp: string;
    }>;
  } | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // Keep selected session in sync
  useEffect(() => {
    if (activeSessionId && !selectedSessionForHistory) {
      setSelectedSessionForHistory(activeSessionId);
    }
  }, [activeSessionId, selectedSessionForHistory]);

  // Fetch session details whenever selectedSessionForHistory changes
  useEffect(() => {
    if (!selectedSessionForHistory) return;
    let isMounted = true;
    setIsLoadingSession(true);

    fetch(
      `/api/sessions?tenantId=${tenantId}&sessionId=${selectedSessionForHistory}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data) {
          setSessionDetails({
            turns: data.turns || [],
            episodes: data.episodes || [],
          });
        }
      })
      .catch(() => {
        // Fallback gracefully
      })
      .finally(() => {
        if (isMounted) setIsLoadingSession(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSessionForHistory, tenantId]);

  const runbookCount = deduplicatedProcedures.length;
  const runbookText = runbookCount === 1 ? "1 Runbook" : `${runbookCount} Runbooks`;

  return (
    <div className="p-5 max-w-[1600px] mx-auto space-y-6 animate-fade-in select-none">
      {/* ═══ Header ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#1c202b]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              Episodic Memory & Calibrated Runbook Library
            </h1>
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
              EMPIRICAL SCORING
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Cross-session cognitive state stored in FalkorDB multigraph. Dynamic Bayesian confidence
            mutation on <code>[:LED_TO_RESOLUTION]</code> edges.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-zinc-300 bg-[#0c0e14] border border-[#1c202b] px-2 py-1 rounded">
            {runbookText} Indexed
          </span>
          <span className="text-zinc-300 bg-[#0c0e14] border border-[#1c202b] px-2 py-1 rounded">
            {inspectData?.counts?.episodes ?? 14} Episodes Recorded
          </span>
        </div>
      </div>

      {/* ═══ Section 1: Procedural Playbooks Matrix & Empirical Confidence Mutator ═══ */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
              Procedural Playbooks & Real-Time Confidence Calibration
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Executing feedback triggers live OpenCypher edge weight mutation in FalkorDB with Laplace empirical priors.
            </p>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">
            Weight Formula: (S + 1) / (S + F + 2)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deduplicatedProcedures.map((pw) => {
            const weightPct = Math.round(pw.confidenceWeight * 100);
            const isSelectedCandidate =
              lastSwarmResult?.selectedProcedure?.procedureId === pw.procedureId;
            const isPrimary = pw.confidenceWeight >= 0.7 || isSelectedCandidate;
            const isDeprecated = pw.confidenceWeight < 0.4;
            const playbooks = PROCEDURE_PLAYBOOKS_MAP[pw.procedureId] || [
              {
                step: "Inspect service telemetry in FalkorDB",
                cmd: "falkordb-cli -g $TENANT_GRAPH 'MATCH (s:Service) RETURN s.latency_p99'",
              },
              {
                step: "Execute automated mitigation script",
                cmd: `sh /opt/sre/playbooks/${pw.procedureId}.sh --dry-run=false`,
              },
              {
                step: "Validate health recovery across dependencies",
                cmd: "curl -s http://healthcheck.internal:8080/ready",
              },
            ];

            return (
              <div
                key={pw.procedureId}
                className="card p-4 rounded-md border border-[#1c202b] bg-[#0c0e14] space-y-3.5 hover:border-[#2a3040] transition-colors"
              >
                {/* Header & Badges */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {isPrimary ? (
                        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.2 rounded font-semibold">
                          PRIMARY RUNBOOK
                        </span>
                      ) : isDeprecated ? (
                        <span className="text-[9px] font-mono text-rose-400 bg-rose-950/40 border border-rose-500/30 px-1.5 py-0.2 rounded font-semibold">
                          LOW CONFIDENCE
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono text-amber-400 bg-amber-950/40 border border-amber-500/30 px-1.5 py-0.2 rounded font-semibold">
                          STANDBY PLAYBOOK
                        </span>
                      )}
                      <code className="text-xs font-mono text-zinc-300 font-semibold">
                        {pw.procedureId}
                      </code>
                    </div>

                    <h3 className="text-xs font-semibold text-zinc-100 mt-1 font-mono">
                      {pw.procedureName}
                    </h3>

                    {/* Linked Target Services */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                        Target Services:
                      </span>
                      {pw.targetServices.map((svc) => (
                        <span
                          key={svc.serviceId}
                          className="px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-[10px]"
                        >
                          {svc.serviceName || svc.serviceId}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Confidence Gauge */}
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-zinc-200 font-mono tabular-nums">
                      {weightPct}% Confidence
                    </span>
                    <div className="w-24 h-1.5 bg-zinc-900 rounded-full mt-1 overflow-hidden border border-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          weightPct >= 70
                            ? "bg-emerald-400"
                            : weightPct >= 40
                            ? "bg-amber-400"
                            : "bg-rose-400"
                        }`}
                        style={{ width: `${weightPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-1 block font-mono tabular-nums">
                      {pw.successCount} succ · {pw.failCount} fail
                    </span>
                  </div>
                </div>

                {/* Ansible/Terraform-style Playbook CLI Commands */}
                <div className="bg-[#080a0f] p-3 rounded border border-[#1c202b] space-y-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono block font-semibold">
                    Playbook Tasks & Commands:
                  </span>
                  <div className="space-y-2">
                    {playbooks.map((task, sIdx) => (
                      <div key={sIdx} className="space-y-0.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1 py-0.2 rounded shrink-0">
                            TASK {sIdx + 1}
                          </span>
                          <span className="text-zinc-300 font-mono text-[11px] font-medium truncate">
                            {task.step}
                          </span>
                        </div>
                        <pre className="text-[10px] font-mono text-zinc-400 bg-[#050608] p-1.5 rounded border border-[#181c26] overflow-x-auto select-all">
                          $ {task.cmd}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Operational Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-[#181c26] flex-wrap gap-2">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Record Live Outcome in FalkorDB:
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        submitFeedback(pw.procedureId, pw.primaryServiceId, "SUCCESS")
                      }
                      disabled={feedbackLoading === `${pw.procedureId}-SUCCESS`}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-emerald-500/30 bg-emerald-950/20 px-3 py-1.5 text-xs font-mono font-medium text-emerald-300 hover:bg-emerald-950/40 transition-colors cursor-pointer disabled:opacity-50"
                      title="Increments success_count, raises confidence weight, and records new Episode"
                    >
                      {feedbackLoading === `${pw.procedureId}-SUCCESS` ? (
                        <span className="spinner" />
                      ) : (
                        <TrendingUp className="w-3.5 h-3.5" />
                      )}
                      Record Success (+Weight)
                    </button>

                    <button
                      onClick={() =>
                        submitFeedback(pw.procedureId, pw.primaryServiceId, "FAILURE")
                      }
                      disabled={feedbackLoading === `${pw.procedureId}-FAILURE`}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-rose-500/30 bg-rose-950/20 px-3 py-1.5 text-xs font-mono font-medium text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
                      title="Increments fail_count, lowers confidence weight, and records failed Episode"
                    >
                      {feedbackLoading === `${pw.procedureId}-FAILURE` ? (
                        <span className="spinner" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      Record Failure (-Weight)
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ Section 2: Cross-Session Episodic Memory & Conversation Turn Timeline ═══ */}
      <div className="card p-4 border border-[#1c202b] bg-[#0c0e14] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#1c202b]">
          <div>
            <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-zinc-400" />
              Cross-Session Episodic Memory & Turn Chain Timeline
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Persistent conversation turns linked via <code>[:HAS_TURN]</code> and <code>[:NEXT_TURN]</code> with correlated <code>(:Episode)</code> memories.
            </p>
          </div>

          {/* Session Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 font-mono">Session:</span>
            <select
              value={selectedSessionForHistory}
              onChange={(e) => setSelectedSessionForHistory(e.target.value)}
              className="bg-[#080a0f] text-zinc-200 font-mono text-xs px-2.5 py-1 rounded border border-[#1c202b] outline-none cursor-pointer"
            >
              <option value={activeSessionId}>
                {activeSessionId} (Active)
              </option>
              {sessionsList
                .filter((s) => s.id !== activeSessionId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} ({s.turnCount} turns)
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Timeline Content */}
        {isLoadingSession ? (
          <div className="py-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2 font-mono">
            <span className="spinner" />
            Querying persistent FalkorDB turn graph...
          </div>
        ) : sessionDetails && (sessionDetails.turns.length > 0 || sessionDetails.episodes.length > 0) ? (
          <div className="space-y-4">
            {/* Correlated Episodes in this Session */}
            {sessionDetails.episodes.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block font-semibold">
                  Episodes Correlated with this Session:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sessionDetails.episodes.map((ep) => (
                    <div
                      key={ep.id}
                      className="p-3 rounded bg-[#080a0f] border border-[#1c202b] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.2 rounded">
                          {ep.id}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
                          {new Date(ep.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="font-semibold text-zinc-200 text-xs font-mono">
                        Symptom: {ep.symptom}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono">
                        Root Cause: {ep.root_cause}
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-snug">
                        {ep.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation Turn Chain */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block font-semibold">
                Turn Chain Timeline ([:NEXT_TURN]):
              </span>
              <div className="space-y-2.5 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-[#1c202b] pl-7">
                {sessionDetails.turns.map((turn, tIdx) => (
                  <div
                    key={turn.id}
                    className="relative p-3 rounded bg-[#080a0f] border border-[#1c202b] text-xs space-y-1"
                  >
                    <div className="absolute -left-[19px] top-3.5 w-2 h-2 rounded-full bg-zinc-400 ring-4 ring-[#0c0e14]" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.2 rounded uppercase">
                          {turn.role}
                        </span>
                        <code className="text-[10px] font-mono text-zinc-500">
                          {turn.id}
                        </code>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
                        {new Date(turn.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-300 font-mono whitespace-pre-line leading-relaxed">
                      {turn.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-zinc-500 space-y-1 font-mono">
            <History className="w-6 h-6 text-zinc-600 mx-auto" />
            <p>No turns or episodes recorded in this session yet.</p>
            <p className="text-[10px]">
              Dispatch an incident swarm in War Room to write turn nodes to FalkorDB.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
