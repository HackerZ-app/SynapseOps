"use client";

import React, { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Brain,
  Flame,
  Network,
  BookOpen,
  Terminal,
  Gauge,
  RefreshCcw,
  Database,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronRight,
  Shield,
  Activity,
  Cpu,
} from "lucide-react";
import { useSynapse } from "@/context/SynapseContext";
import { Tenant } from "@/types/synapse";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    tenantId,
    switchTenant,
    seedTenant,
    isSeeding,
    inspectData,
    lastSwarmResult,
    canvasNodes,
    canvasEdges,
    deduplicatedProcedures,
    telemetryLog,
    feedbackToast,
    setFeedbackToast,
    seedStatus,
    setSeedStatus,
    runBenchmark,
    isBenchmarking,
  } = useSynapse();

  // Clean, single-line enterprise navigation items that NEVER truncate in w-60
  const navItems = [
    {
      label: "Command Overview",
      href: "/",
      icon: Activity,
      badge: `${canvasNodes.length || 29}`,
      badgeType: "counter" as const,
    },
    {
      label: "Incident Response",
      href: "/war-room",
      icon: Flame,
      badge: lastSwarmResult ? "ACTIVE" : "READY",
      badgeType: "status" as const,
      isActiveAlert: Boolean(lastSwarmResult),
    },
    {
      label: "Service Topology",
      href: "/topology",
      icon: Network,
      badge: `${canvasNodes.length}N·${canvasEdges.length}E`,
      badgeType: "counter" as const,
    },
    {
      label: "Runbook Library",
      href: "/memory",
      icon: BookOpen,
      badge: `${deduplicatedProcedures.length}`,
      badgeType: "counter" as const,
    },
    {
      label: "Query Telemetry",
      href: "/telemetry",
      icon: Terminal,
      badge: `${telemetryLog.length}`,
      badgeType: "counter" as const,
    },
  ];

  // Benchmark quick trigger
  const handleQuickBenchmark = async () => {
    if (pathname !== "/telemetry") {
      router.push("/telemetry");
    }
    await runBenchmark(24);
  };

  const activeGraphKey =
    inspectData?.graphName || `synapse_tenant_${tenantId.replace("-", "_")}`;

  const currentWorkspaceName =
    navItems.find((n) => n.href === pathname)?.label || "Command Overview";

  return (
    <div className="min-h-screen flex bg-[#080a0f] text-zinc-100 antialiased font-sans">
      {/* ═══ Left Enterprise Sidebar (w-60 shrink-0) ═══ */}
      <aside className="w-60 shrink-0 border-r border-[#1c202b] bg-[#0c0e14] flex flex-col justify-between sticky top-0 h-screen z-40 select-none">
        <div>
          {/* Logo & Brand Header */}
          <Link
            href="/"
            className="h-14 px-4 border-b border-[#1c202b] flex items-center gap-2.5 hover:bg-[#10131c] transition-colors group"
          >
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200 group-hover:border-blue-500/50 transition-colors">
              <Brain className="w-4 h-4 text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm tracking-tight text-zinc-100">
                  Synapse<span className="text-blue-400">Ops</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-500 px-1 py-0.2 bg-zinc-900 border border-zinc-800 rounded">
                  SRE
                </span>
              </div>
              <p className="text-[10px] font-mono text-zinc-500 truncate">
                Cognitive Control Plane
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="p-2.5 space-y-1">
            <div className="px-2.5 py-1 text-[10px] uppercase font-mono tracking-wider text-zinc-500">
              Control Center
            </div>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-all group ${
                    isActive
                      ? "bg-[#141824] text-white border border-[#242a38]"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-[#10131c] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive
                          ? "text-blue-400"
                          : "text-zinc-500 group-hover:text-zinc-300"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {/* Sleek Monospace Counters & Status Indicators */}
                  {item.badgeType === "status" ? (
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        item.isActiveAlert
                          ? "text-rose-400 bg-rose-950/30 border-rose-500/30"
                          : "text-emerald-400 bg-emerald-950/30 border-emerald-500/30"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.isActiveAlert
                            ? "bg-rose-400 animate-pulse"
                            : "bg-emerald-400"
                        }`}
                      />
                      {item.badge}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/90 border border-zinc-800 px-1.5 py-0.2 rounded tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Engine Connection Status Card */}
        <div className="p-3 border-t border-[#1c202b] bg-[#080a0f] space-y-2 text-xs">
          <div className="p-2.5 rounded-md bg-[#0c0e14] border border-[#1c202b] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                FalkorDB Engine v4.x
              </span>
              <span className="text-[10px] font-mono text-emerald-400">
                CONNECTED
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#181c26]">
              <span
                className="text-[11px] font-mono text-zinc-400 truncate max-w-[130px]"
                title={activeGraphKey}
              >
                {activeGraphKey}
              </span>
              <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1 py-0.2 rounded">
                ISOLATED
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 px-0.5 font-mono">
            <span>SLO Compliance</span>
            <span className="text-zinc-400 font-semibold">99.98%</span>
          </div>
        </div>
      </aside>

      {/* ═══ Main Content Container ═══ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Global Control Header Bar (Linear/Datadog style) */}
        <header className="h-14 border-b border-[#1c202b] bg-[#0c0e14]/90 backdrop-blur-md sticky top-0 z-30 px-5 flex items-center justify-between shrink-0">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500 font-mono">Control Plane</span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
            <span className="font-medium text-zinc-100">
              {currentWorkspaceName}
            </span>
            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.2 rounded ml-1 hidden sm:inline-block">
              {tenantId}
            </span>
          </div>

          {/* Right Header Tools */}
          <div className="flex items-center gap-2.5">
            {/* Sleek Segmented Organization Switcher */}
            <div className="flex items-center bg-[#080a0f] p-0.5 rounded-md border border-[#1c202b] text-xs">
              {(["acme-fintech", "nebula-cloud"] as Tenant[]).map((t) => {
                const isSelected = tenantId === t;
                return (
                  <button
                    key={t}
                    onClick={() => switchTenant(t)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#1c2233] text-zinc-100 border border-[#2d374d] shadow-sm font-semibold"
                        : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            {/* Subtle Stress Test (24x) Button */}
            <button
              onClick={handleQuickBenchmark}
              disabled={isBenchmarking}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-all cursor-pointer disabled:opacity-40"
              title="Execute burst parallel read/write load test across both tenant graphs"
            >
              {isBenchmarking ? (
                <span className="spinner" />
              ) : (
                <Gauge className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="hidden sm:inline">Stress Test (24x)</span>
              <span className="sm:hidden">24x</span>
            </button>

            {/* Re-Initialize Graph Button */}
            <button
              onClick={() => seedTenant(true)}
              disabled={isSeeding}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition-all cursor-pointer disabled:opacity-40"
              title="Reset and re-seed active tenant graph in FalkorDB with fresh topology"
            >
              <RefreshCcw
                className={`w-3.5 h-3.5 text-zinc-400 ${
                  isSeeding ? "animate-spin" : ""
                }`}
              />
              <span className="hidden md:inline">Re-Initialize Graph</span>
            </button>
          </div>
        </header>

        {/* Global Toast / Feedback Alerts */}
        {feedbackToast && (
          <div className="bg-emerald-950/80 border-b border-emerald-500/30 px-5 py-2 flex items-center justify-between text-xs text-emerald-200 animate-slide-down">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-mono">{feedbackToast}</span>
            </div>
            <button
              onClick={() => setFeedbackToast(null)}
              className="opacity-70 hover:opacity-100 font-bold ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {seedStatus && (
          <div
            className={`border-b px-5 py-2 flex items-center justify-between text-xs animate-slide-down ${
              seedStatus.type === "success"
                ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-200"
                : "bg-rose-950/80 border-rose-500/30 text-rose-200"
            }`}
          >
            <div className="flex items-center gap-2 font-mono">
              {seedStatus.type === "success" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              )}
              <span>{seedStatus.message}</span>
            </div>
            <button
              onClick={() => setSeedStatus(null)}
              className="opacity-70 hover:opacity-100 font-bold ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Dynamic Workspace Page Render */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
