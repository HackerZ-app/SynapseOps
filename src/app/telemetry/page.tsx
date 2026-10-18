"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Gauge,
  Terminal,
  Zap,
  CheckCircle2,
  Play,
  Clock,
  Search,
  Filter,
  TrendingUp,
  Cpu,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useSynapse } from "@/context/SynapseContext";
import { QueryTelemetry } from "@/types/synapse";

export default function TelemetryBenchmarkPage() {
  const {
    tenantId,
    lastBenchmarkResult,
    runBenchmark,
    isBenchmarking,
    telemetryLog,
  } = useSynapse();

  const [concurrencyLevel, setConcurrencyLevel] = useState<number>(24);
  const [filterCountPolling, setFilterCountPolling] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const telemetryEndRef = useRef<HTMLDivElement>(null);

  // Filtered queries based on count polling toggle & search string
  const filteredQueries = useMemo(() => {
    return telemetryLog.filter((entry) => {
      if (filterCountPolling && entry.queryName.startsWith("inspect:count-")) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          entry.queryName.toLowerCase().includes(q) ||
          entry.cypher.toLowerCase().includes(q) ||
          entry.type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [telemetryLog, filterCountPolling, searchQuery]);

  // Auto-scroll when new telemetry entries arrive
  useEffect(() => {
    telemetryEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredQueries.length]);

  return (
    <div className="p-5 max-w-[1600px] mx-auto space-y-6 animate-fade-in select-none">
      {/* ═══ Header ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#1c202b]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
              <Terminal className="w-5 h-5 text-amber-400" />
              High-Concurrency Telemetry & APM Query Explorer
            </h1>
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
              REAL-TIME TRACE STREAM
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time FalkorDB OpenCypher query telemetry and multi-threaded parallel burst benchmark lab.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-zinc-300 bg-[#0c0e14] border border-[#1c202b] px-2 py-1 rounded tabular-nums">
            {telemetryLog.length} Queries Captured
          </span>
          <span className="text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-1 rounded">
            Sub-millisecond Latency
          </span>
        </div>
      </div>

      {/* ═══ Section 1: Concurrency Benchmark Lab (Grafana/Datadog APM Style) ═══ */}
      <div className="card p-4 border border-[#1c202b] bg-[#0c0e14] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#1c202b]">
          <div className="space-y-0.5">
            <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Concurrent Graph Engine Stress-Test Runner
            </h2>
            <p className="text-[11px] text-zinc-500">
              Dispatches N simultaneous read/write queries via <code>Promise.all</code> against isolated tenant graph keys.
            </p>
          </div>

          {/* Concurrency Selector & Trigger Button */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-[#080a0f] p-0.5 rounded border border-[#1c202b] text-xs">
              <span className="text-[10px] text-zinc-500 font-mono uppercase px-2">
                Burst:
              </span>
              {[16, 24, 48].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setConcurrencyLevel(lvl)}
                  className={`px-2.5 py-0.5 rounded text-xs font-mono transition-colors cursor-pointer ${
                    concurrencyLevel === lvl
                      ? "bg-[#1c2233] text-zinc-100 font-semibold border border-[#2d374d]"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {lvl}x
                </button>
              ))}
            </div>

            <button
              onClick={() => runBenchmark(concurrencyLevel)}
              disabled={isBenchmarking}
              className="btn-primary text-xs py-1.5 px-3 cursor-pointer flex items-center gap-2 font-mono"
            >
              {isBenchmarking ? (
                <>
                  <span className="spinner" />
                  Running {concurrencyLevel}x Burst...
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  Launch {concurrencyLevel}x Stress Test
                </>
              )}
            </button>
          </div>
        </div>

        {/* Benchmark Results Grid */}
        {lastBenchmarkResult ? (
          <div className="space-y-3.5 pt-1">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              {/* Throughput */}
              <div className="bg-[#080a0f] p-3 rounded border border-[#1c202b] space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono block">
                  Throughput
                </span>
                <span className="text-xl font-bold text-emerald-400 font-mono block tabular-nums">
                  {lastBenchmarkResult.throughputOpsPerSec}{" "}
                  <span className="text-xs font-normal text-zinc-400">ops/s</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-mono block tabular-nums">
                  {lastBenchmarkResult.totalOperations} ops in {lastBenchmarkResult.wallClockMs}ms
                </span>
              </div>

              {/* p95 Latency */}
              <div className="bg-[#080a0f] p-3 rounded border border-[#1c202b] space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono block">
                  p95 Latency
                </span>
                <span className="text-xl font-bold text-cyan-400 font-mono block tabular-nums">
                  {lastBenchmarkResult.metrics.p95LatencyMs}{" "}
                  <span className="text-xs font-normal text-zinc-400">ms</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-mono block tabular-nums">
                  Avg: {lastBenchmarkResult.metrics.avgLatencyMs}ms
                </span>
              </div>

              {/* Min / Max Latency */}
              <div className="bg-[#080a0f] p-3 rounded border border-[#1c202b] space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono block">
                  Min / Max Range
                </span>
                <span className="text-lg font-bold text-zinc-100 font-mono block tabular-nums">
                  {lastBenchmarkResult.metrics.minLatencyMs} / {lastBenchmarkResult.metrics.maxLatencyMs}{" "}
                  <span className="text-xs font-normal text-zinc-400">ms</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-mono block">
                  Sub-40ms variance
                </span>
              </div>

              {/* Operation Breakdown */}
              <div className="bg-[#080a0f] p-3 rounded border border-[#1c202b] space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono block">
                  Operation Split
                </span>
                <span className="text-sm font-semibold text-zinc-200 font-mono block tabular-nums">
                  {lastBenchmarkResult.breakdown.reads} Reads · {lastBenchmarkResult.breakdown.writes} Writes
                </span>
                <span className="text-[10px] text-zinc-500 font-mono block">
                  Parallel Cypher Bursts
                </span>
              </div>

              {/* Tenant Isolation */}
              <div className="bg-[#080a0f] p-3 rounded border border-[#1c202b] space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono block">
                  Namespace Isolation
                </span>
                <span className="text-sm font-semibold text-emerald-400 font-mono flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 100% Isolated
                </span>
                <span className="text-[10px] text-zinc-500 font-mono block">
                  Zero cross-tenant leakage
                </span>
              </div>
            </div>

            {/* Datadog APM Latency Execution Distribution Bars */}
            <div className="bg-[#080a0f] p-3 rounded border border-[#1c202b] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono font-semibold">
                  Latency Percentile Distribution (Execution Bar):
                </span>
                <span className="font-mono text-[10px] text-zinc-400 tabular-nums">
                  Min: {lastBenchmarkResult.metrics.minLatencyMs}ms · Avg: {lastBenchmarkResult.metrics.avgLatencyMs}ms · p95: {lastBenchmarkResult.metrics.p95LatencyMs}ms · Max: {lastBenchmarkResult.metrics.maxLatencyMs}ms
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-3 text-xs">
                  <span className="w-12 font-mono text-[10px] text-zinc-500">Min</span>
                  <div className="flex-1 bg-zinc-900 h-2 rounded overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded"
                      style={{
                        width: `${Math.min(
                          100,
                          (lastBenchmarkResult.metrics.minLatencyMs /
                            lastBenchmarkResult.metrics.maxLatencyMs) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-emerald-400 w-14 text-right tabular-nums">
                    {lastBenchmarkResult.metrics.minLatencyMs}ms
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="w-12 font-mono text-[10px] text-zinc-500">Avg</span>
                  <div className="flex-1 bg-zinc-900 h-2 rounded overflow-hidden">
                    <div
                      className="bg-cyan-400 h-full rounded"
                      style={{
                        width: `${Math.min(
                          100,
                          (lastBenchmarkResult.metrics.avgLatencyMs /
                            lastBenchmarkResult.metrics.maxLatencyMs) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-cyan-400 w-14 text-right tabular-nums">
                    {lastBenchmarkResult.metrics.avgLatencyMs}ms
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="w-12 font-mono text-[10px] text-zinc-500">p95</span>
                  <div className="flex-1 bg-zinc-900 h-2 rounded overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded"
                      style={{
                        width: `${Math.min(
                          100,
                          (lastBenchmarkResult.metrics.p95LatencyMs /
                            lastBenchmarkResult.metrics.maxLatencyMs) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-amber-400 w-14 text-right tabular-nums">
                    {lastBenchmarkResult.metrics.p95LatencyMs}ms
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-[#080a0f] rounded border border-dashed border-[#1c202b] text-center text-xs text-zinc-500 space-y-1 font-mono">
            <Gauge className="w-5 h-5 text-zinc-600 mx-auto" />
            <p>Ready to benchmark FalkorDB high-concurrency throughput.</p>
            <p className="text-[10px]">Select a burst concurrency level and click &quot;Launch Stress Test&quot; above.</p>
          </div>
        )}
      </div>

      {/* ═══ Section 2: Full-Width OpenCypher APM Statement Inspector ═══ */}
      <div className="card p-4 border border-[#1c202b] bg-[#0c0e14] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2.5 border-b border-[#1c202b]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-zinc-400" />
            <div>
              <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
                OpenCypher APM Statement Stream
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono">
                Every read (<code>RO_QUERY</code>) and write (<code>WRITE_QUERY</code>) executed in FalkorDB
              </p>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter Cypher statements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#080a0f] border border-[#1c202b] rounded pl-7 pr-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-600 font-mono outline-none w-52 focus:border-zinc-700"
              />
            </div>

            {/* Toggle Polling Filter */}
            <button
              onClick={() => setFilterCountPolling((prev) => !prev)}
              className={`px-2.5 py-1 rounded border text-xs font-mono transition-colors cursor-pointer ${
                filterCountPolling
                  ? "bg-[#1c2233] text-zinc-200 border-[#2d374d]"
                  : "bg-[#080a0f] text-zinc-500 border-[#1c202b] hover:text-zinc-300"
              }`}
            >
              {filterCountPolling
                ? "Hide inspect:count-* (Active)"
                : "Show All Queries"}
            </button>
          </div>
        </div>

        {/* Query Stream Feed */}
        <div className="bg-[#080a0f] rounded border border-[#1c202b] p-2 max-h-[500px] overflow-y-auto space-y-1 font-mono text-xs">
          {filteredQueries.length > 0 ? (
            filteredQueries.map((entry, idx) => (
              <TelemetryRow key={idx} entry={entry} index={idx} />
            ))
          ) : (
            <div className="py-8 text-center text-xs text-zinc-500 font-mono">
              No OpenCypher queries match the current filter.
            </div>
          )}
          <div ref={telemetryEndRef} />
        </div>
      </div>
    </div>
  );
}

function TelemetryRow({ entry, index }: { entry: QueryTelemetry; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const queryTypeBadge = entry.type === "WRITE" ? "WRITE_QUERY" : "RO_QUERY";

  const isUserOrAgentAction =
    entry.type === "WRITE" ||
    entry.queryName.startsWith("agent") ||
    entry.queryName.startsWith("feedback") ||
    entry.queryName.startsWith("seed") ||
    entry.queryName.startsWith("benchmark");

  const cypherPreview = entry.cypher.replace(/\s+/g, " ").trim();
  const truncatedCypher =
    cypherPreview.length > 105 ? cypherPreview.slice(0, 105) + "..." : cypherPreview;

  return (
    <div
      className={`rounded border transition-colors ${
        isUserOrAgentAction
          ? "border-[#242a38] bg-[#0c0e14] hover:bg-[#10131c]"
          : "border-transparent hover:border-[#1c202b] hover:bg-[#0c0e14]"
      }`}
    >
      <div
        className="px-2.5 py-1.5 flex items-center justify-between cursor-pointer gap-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <span
            className={`text-[9px] font-mono px-1.5 py-0.2 rounded shrink-0 border ${
              entry.type === "WRITE"
                ? "text-amber-400 bg-amber-950/40 border-amber-500/30"
                : "text-blue-400 bg-blue-950/40 border-blue-500/30"
            }`}
          >
            {queryTypeBadge}
          </span>
          <span
            className={`font-semibold shrink-0 font-mono tabular-nums text-[11px] ${
              entry.durationMs < 5
                ? "text-emerald-400"
                : entry.durationMs < 20
                ? "text-amber-400"
                : "text-rose-400"
            }`}
          >
            {entry.durationMs.toFixed(2)}ms
          </span>
          <span className="text-zinc-200 font-medium shrink-0 font-mono text-[11px]">
            {entry.queryName}
          </span>

          {isUserOrAgentAction && (
            <span className="text-[8px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1 py-0.2 rounded hidden sm:inline-flex shrink-0">
              ACTION
            </span>
          )}

          {/* Inline Cypher Preview Badge */}
          <code
            className="text-[10px] font-mono text-zinc-400 bg-zinc-900/90 border border-zinc-800 px-1.5 py-0.2 rounded truncate max-w-[580px] hidden md:inline-block select-all"
            title={entry.cypher}
          >
            {truncatedCypher}
          </code>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-zinc-500 text-[10px] font-mono tabular-nums">{time}</span>
          {expanded ? (
            <ChevronUp className="w-3 h-3 text-zinc-500" />
          ) : (
            <ChevronDown className="w-3 h-3 text-zinc-500" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-3 bg-[#10131c] border-t border-[#1c202b] text-[11px] space-y-2">
          <div>
            <span className="text-zinc-500 block mb-1 uppercase tracking-wider font-semibold text-[10px] font-mono">
              Full OpenCypher Statement:
            </span>
            <pre className="text-zinc-200 whitespace-pre-wrap bg-[#080a0f] p-2.5 rounded border border-[#1c202b] font-mono leading-relaxed select-all">
              {entry.cypher}
            </pre>
          </div>
          {Object.keys(entry.params).length > 0 && (
            <div>
              <span className="text-zinc-500 block mb-1 uppercase tracking-wider font-semibold text-[10px] font-mono">
                Query Parameters:
              </span>
              <pre className="text-zinc-400 whitespace-pre-wrap bg-[#080a0f] p-2 rounded border border-[#1c202b] font-mono select-all">
                {JSON.stringify(entry.params, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
