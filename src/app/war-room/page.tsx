"use client";

import React from "react";
import Link from "next/link";
import {
  Flame,
  Workflow,
  ArrowRight,
  Play,
  History,
  Server,
  Brain,
  Database,
  CheckCircle2,
  Terminal,
  Activity,
  Layers,
  Clock,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { useSynapse } from "@/context/SynapseContext";
import { PRESETS } from "@/types/synapse";
import DecisionPathBanner from "@/components/DecisionPathBanner";

export default function WarRoomPage() {
  const {
    tenantId,
    inspectData,
    lastSwarmResult,
    isInvestigating,
    alertText,
    setAlertText,
    dispatchSwarm,
    activeSessionId,
    setSessionId,
    sessionsList,
    startNewSession,
    setSelectedHopNodeId,
  } = useSynapse();

  const counts = inspectData?.counts;
  const activeGraphKey =
    inspectData?.graphName || `synapse_tenant_${tenantId.replace("-", "_")}`;

  return (
    <div className="p-5 max-w-[1600px] mx-auto space-y-5 animate-fade-in select-none">
      {/* ═══ Top High-Density Metric Strip ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Monitored Services */}
        <div className="card p-3.5 space-y-1.5 bg-[#0c0e14] border-[#1c202b]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-zinc-400" />
              Monitored Services
            </span>
            <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1 py-0.2 rounded">
              Topology
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-zinc-100 tabular-nums">
              {counts?.services ?? 29}
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              {counts?.teams ?? 5} Teams
            </span>
          </div>
        </div>

        {/* Historical Episodes */}
        <div className="card p-3.5 space-y-1.5 bg-[#0c0e14] border-[#1c202b]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-zinc-400" />
              Historical Episodes
            </span>
            <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1 py-0.2 rounded">
              Episodic
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-zinc-100 tabular-nums">
              {counts?.episodes ?? 14}
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              {counts?.turns ?? 42} Turns
            </span>
          </div>
        </div>

        {/* Calibrated Runbooks */}
        <div className="card p-3.5 space-y-1.5 bg-[#0c0e14] border-[#1c202b]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-zinc-400" />
              Calibrated Runbooks
            </span>
            <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1 py-0.2 rounded">
              Procedural
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-zinc-100 tabular-nums">
              {counts?.procedures ?? 4}
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              Bayes Prior
            </span>
          </div>
        </div>

        {/* Active Tenant Graph */}
        <div className="card p-3.5 space-y-1.5 bg-[#0c0e14] border-[#1c202b]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-zinc-400" />
              Tenant Graph Key
            </span>
            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1 py-0.2 rounded">
              ISOLATED
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className="text-xs font-mono font-semibold text-zinc-200 truncate max-w-[150px]"
              title={activeGraphKey}
            >
              {activeGraphKey}
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              {tenantId}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ "Show the Path Behind an Answer" Decision Path Banner ═══ */}
      {lastSwarmResult && (
        <DecisionPathBanner
          matchedService={lastSwarmResult.matchedService}
          rootCauseService={lastSwarmResult.rootCauseService}
          selectedProcedure={lastSwarmResult.selectedProcedure}
          hopsCount={
            lastSwarmResult.matchedService.id === lastSwarmResult.rootCauseService.id ? 1 : 2
          }
          onSelectHopNode={(nodeId) => setSelectedHopNodeId(nodeId)}
        />
      )}

      {/* ═══ Main 2-Column War Room Layout ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ── Left Column (5 cols): Incident Dispatcher & Swarm Agent Roster ── */}
        <div className="lg:col-span-5 space-y-4">
          {/* Incident Swarm Dispatcher Card */}
          <div className="card p-4 space-y-3.5 bg-[#0c0e14] border-[#1c202b]">
            <div className="flex items-center justify-between pb-2 border-b border-[#1c202b]">
              <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                Incident Swarm Dispatcher
              </h2>

              {/* Session Selector */}
              <div className="flex items-center gap-1.5">
                <div className="bg-[#080a0f] px-2 py-0.5 rounded border border-[#1c202b] flex items-center gap-1">
                  <History className="w-3 h-3 text-zinc-400" />
                  <select
                    value={activeSessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    className="bg-transparent text-zinc-200 font-mono text-[10px] outline-none cursor-pointer max-w-[110px] truncate"
                  >
                    <option value={activeSessionId} className="bg-[#0c0e14]">
                      {activeSessionId ? `${activeSessionId} (Active)` : "Active Session"}
                    </option>
                    {sessionsList
                      .filter((s) => s.id !== activeSessionId)
                      .map((s) => (
                        <option key={s.id} value={s.id} className="bg-[#0c0e14]">
                          {s.id} ({s.turnCount} turns)
                        </option>
                      ))}
                  </select>
                </div>

                <button
                  onClick={startNewSession}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10131c] hover:bg-[#181d2a] border border-[#1c202b] text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  title="Start fresh session"
                >
                  + New
                </button>
              </div>
            </div>

            {/* Scenario Presets with SRE Severity Badges */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider block">
                Standard Incident Scenarios ({tenantId}):
              </span>
              <div className="flex flex-col gap-1.5">
                {PRESETS[tenantId].map((preset, idx) => {
                  const severityBadge = idx === 0 ? "SEV-1 CRITICAL" : "SEV-2 HIGH";
                  const isSev1 = idx === 0;

                  return (
                    <button
                      key={idx}
                      onClick={() => setAlertText(preset.alert)}
                      className="text-left text-xs bg-[#080a0f] hover:bg-[#10131c] border border-[#1c202b] hover:border-[#2a3040] p-2 rounded transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div className="truncate mr-2 flex items-center gap-2">
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                            isSev1
                              ? "text-rose-400 bg-rose-950/40 border-rose-500/30"
                              : "text-amber-400 bg-amber-950/40 border-amber-500/30"
                          }`}
                        >
                          {severityBadge}
                        </span>
                        <span className="text-zinc-300 group-hover:text-white font-medium text-[11px] truncate">
                          {preset.label}
                        </span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Alert Input Textarea */}
            <div>
              <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider block mb-1">
                Incident Alert Payload / Telemetry Anomaly:
              </label>
              <textarea
                value={alertText}
                onChange={(e) => setAlertText(e.target.value)}
                rows={3}
                placeholder="Paste alert payload or describe symptoms..."
                className="w-full bg-[#080a0f] border border-[#1c202b] focus:border-blue-500/50 rounded p-2 text-xs text-zinc-200 placeholder-zinc-600 font-mono resize-none outline-none transition-colors leading-relaxed"
              />
            </div>

            {/* Action Trigger */}
            <button
              onClick={() => dispatchSwarm()}
              disabled={isInvestigating || !alertText.trim()}
              className="btn-primary w-full justify-center text-xs py-2 cursor-pointer font-medium"
            >
              {isInvestigating ? (
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

          {/* Live Swarm Agent Roster */}
          <div className="card p-4 space-y-3 bg-[#0c0e14] border-[#1c202b]">
            <div className="flex items-center justify-between pb-2 border-b border-[#1c202b]">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-300 flex items-center gap-1.5">
                  <Workflow className="w-3.5 h-3.5 text-zinc-400" />
                  Autonomous Agent Roster
                </h3>
                <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                  Stateful Graph Handshake Protocol (:TaskState nodes)
                </p>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                3 AGENTS READY
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Agent 1: Triage */}
              <div className="p-2.5 rounded-md border border-[#1c202b] bg-[#080a0f] space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1 py-0.2 rounded">
                      Stage 1
                    </span>
                    <span className="text-xs font-semibold text-zinc-200 font-mono">
                      agent-triage
                    </span>
                  </div>
                  {isInvestigating ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-blue-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      QUERYING FALKORDB
                    </span>
                  ) : lastSwarmResult ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-400">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      HANDOFF COMMITTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-zinc-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      STANDBY
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400 leading-snug">
                  Traverses semantic dependencies <code>[:DEPENDS_ON*]</code> to compute blast radius boundaries.
                </div>
              </div>

              {/* Agent 2: Investigator */}
              <div className="p-2.5 rounded-md border border-[#1c202b] bg-[#080a0f] space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1 py-0.2 rounded">
                      Stage 2
                    </span>
                    <span className="text-xs font-semibold text-zinc-200 font-mono">
                      agent-investigator
                    </span>
                  </div>
                  {isInvestigating ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-amber-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      QUERYING FALKORDB
                    </span>
                  ) : lastSwarmResult ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-400">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      HANDOFF COMMITTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-zinc-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      STANDBY
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400 leading-snug">
                  Reads incoming handoff, queries cross-session episodes <code>[:AFFECTED]</code>, and isolates root cause.
                </div>
              </div>

              {/* Agent 3: Commander */}
              <div className="p-2.5 rounded-md border border-[#1c202b] bg-[#080a0f] space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1 py-0.2 rounded">
                      Stage 3
                    </span>
                    <span className="text-xs font-semibold text-zinc-200 font-mono">
                      agent-commander
                    </span>
                  </div>
                  {isInvestigating ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-purple-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                      QUERYING FALKORDB
                    </span>
                  ) : lastSwarmResult ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-400">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      HANDOFF COMMITTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-zinc-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      STANDBY
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400 leading-snug">
                  Queries <code>[:LED_TO_RESOLUTION]</code> weights in procedural memory to select highest-confidence playbooks.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column (7 cols): Decision Path Trace & Structured Handoff Timeline ── */}
        <div className="lg:col-span-7 space-y-4">
          {lastSwarmResult ? (
            <div className="space-y-4 animate-fade-in">
              {/* Executive Summary Card */}
              <div className="card p-4 space-y-3 bg-[#0c0e14] border-[#1c202b]">
                <div className="flex items-center justify-between pb-2 border-b border-[#1c202b]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
                      Autonomous Swarm Resolution Plan
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded tabular-nums">
                    Executed in {lastSwarmResult.executionTimeMs}ms
                  </span>
                </div>

                <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line bg-[#080a0f] p-3 rounded border border-[#1c202b] font-mono">
                  {lastSwarmResult.summaryReport}
                </div>

                {/* Selected Runbook Quick Action */}
                {lastSwarmResult.selectedProcedure && (
                  <div className="p-3 rounded-md border border-[#242a38] bg-[#10131c] flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                        Selected Remediation Runbook:
                      </span>
                      <div className="text-xs font-semibold text-zinc-100 mt-0.5">
                        {lastSwarmResult.selectedProcedure.name} (
                        <code className="text-zinc-300 font-mono">
                          {lastSwarmResult.selectedProcedure.procedureId}
                        </code>
                        )
                      </div>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        Confidence:{" "}
                        <strong className="text-emerald-400">
                          {Math.round(
                            lastSwarmResult.selectedProcedure.confidenceWeight * 100
                          )}
                          %
                        </strong>{" "}
                        · Target: {lastSwarmResult.selectedProcedure.targetServiceName}
                      </span>
                    </div>

                    <Link
                      href="/memory"
                      className="text-xs font-mono px-3 py-1.5 rounded bg-[#181d2a] hover:bg-[#202738] border border-[#242a38] text-zinc-200 transition-colors flex items-center gap-1.5"
                    >
                      Execute in Runbook Hub
                      <ArrowRight className="w-3 h-3 text-zinc-400" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Structured Incident Timeline / Handoff Entries (Datadog/PagerDuty style) */}
              <div className="card p-4 space-y-3 bg-[#0c0e14] border-[#1c202b]">
                <div className="flex items-center justify-between pb-2 border-b border-[#1c202b]">
                  <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Workflow className="w-3.5 h-3.5 text-zinc-400" />
                    Agent State Handoff Timeline
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.2 rounded">
                    {lastSwarmResult.handoffEdgesCreated} [:HANDED_OFF_TO] Handshakes
                  </span>
                </div>

                <div className="space-y-3">
                  {lastSwarmResult.agentSteps.map((step, idx) => (
                    <div
                      key={step.agentId}
                      className="rounded-md p-3.5 bg-[#080a0f] border border-[#1c202b] text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.2 rounded">
                            STEP {idx + 1}
                          </span>
                          <span className="font-semibold text-zinc-200 font-mono">
                            {step.agentName}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      {/* Handoff Record */}
                      {step.handoffEdge && (
                        <div className="p-2 rounded bg-[#10131c] border border-[#1e2330] text-[11px] font-mono space-y-0.5">
                          <div className="text-zinc-300 font-medium flex items-center gap-1.5">
                            <ArrowRight className="w-3 h-3 text-zinc-500" />
                            <span>[:HANDED_OFF_TO] → {step.handoffEdge.toAgentId}</span>
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            Reason: {step.handoffEdge.reason}
                          </div>
                        </div>
                      )}

                      {/* Agent Reasoning Log */}
                      <p className="text-[11px] text-zinc-400 whitespace-pre-line leading-relaxed bg-[#0c0e14] p-2 rounded border border-[#181c26] font-mono">
                        {step.reasoning}
                      </p>

                      {/* Queries run */}
                      {step.falkordbQueriesRun && step.falkordbQueriesRun.length > 0 && (
                        <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 flex-wrap font-mono">
                          <Terminal className="w-3 h-3 text-zinc-400" />
                          <span>FalkorDB Queries:</span>
                          {step.falkordbQueriesRun.map((q, qIdx) => (
                            <code
                              key={qIdx}
                              className="px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-[9px]"
                            >
                              {q}
                            </code>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Standby State */
            <div className="card p-8 border-dashed border-[#1c202b] bg-[#0c0e14] text-center space-y-3 flex flex-col items-center justify-center min-h-[420px]">
              <div className="w-10 h-10 rounded-md bg-[#10131c] border border-[#1c202b] flex items-center justify-center text-zinc-400">
                <Flame className="w-5 h-5 text-zinc-400" />
              </div>
              <div className="max-w-sm space-y-1">
                <h3 className="text-sm font-semibold text-zinc-200">
                  Incident War Room on Standby
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Select a standard scenario preset on the left or paste an alert payload, then click <strong>&quot;Dispatch Multi-Agent Incident Swarm&quot;</strong> to begin autonomous investigation.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => dispatchSwarm()}
                  className="btn-primary text-xs py-1.5 px-3.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Dispatch Default Scenario
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
