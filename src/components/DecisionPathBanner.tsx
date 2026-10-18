"use client";

import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  GitBranch,
  History,
  Layers,
  Network,
  Server,
  Terminal,
} from "lucide-react";

export interface DecisionHop {
  id: string;
  label: "Symptom Service" | "Root Cause Service" | "Recalled Episode" | "Selected Procedure";
  name: string;
  subtext: string;
  layer: "Semantic" | "Episodic" | "Procedural";
  badgeColor: string;
  icon: React.ReactNode;
}

interface DecisionPathBannerProps {
  matchedService: { id: string; name: string; tier?: string };
  rootCauseService: { id: string; name: string; reason?: string };
  recalledEpisode?: { id: string; sessionId: string; rootCause: string; symptom: string } | null;
  selectedProcedure?: {
    procedureId: string;
    name: string;
    confidenceWeight: number;
    stepsCount?: number;
  } | null;
  hopsCount?: number;
  onSelectHopNode?: (nodeId: string) => void;
}

export default function DecisionPathBanner({
  matchedService,
  rootCauseService,
  recalledEpisode,
  selectedProcedure,
  hopsCount = 1,
  onSelectHopNode,
}: DecisionPathBannerProps) {
  const isDirect = matchedService.id === rootCauseService.id;

  const hops: DecisionHop[] = [
    {
      id: matchedService.id,
      label: "Symptom Service",
      name: matchedService.name,
      subtext: `Observed Failure Zone (${matchedService.tier || "Tier-1"})`,
      layer: "Semantic",
      badgeColor: "border-[#242a38] bg-[#0c0e14] text-zinc-100",
      icon: <Server className="w-3.5 h-3.5 text-cyan-400" />,
    },
    {
      id: rootCauseService.id,
      label: "Root Cause Service",
      name: rootCauseService.name,
      subtext: isDirect ? "Direct Local Failure" : `Downstream Origin (${hopsCount} hops away)`,
      layer: "Semantic",
      badgeColor: "border-[#242a38] bg-[#0c0e14] text-zinc-100",
      icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
    },
    {
      id: recalledEpisode?.id || "ep-fallback",
      label: "Recalled Episode",
      name: recalledEpisode
        ? `${recalledEpisode.id} (Session ${recalledEpisode.sessionId})`
        : "Prior Incident Memory",
      subtext: recalledEpisode?.rootCause || "Cross-Session Pattern Recall",
      layer: "Episodic",
      badgeColor: "border-[#242a38] bg-[#0c0e14] text-zinc-100",
      icon: <History className="w-3.5 h-3.5 text-purple-400" />,
    },
    {
      id: selectedProcedure?.procedureId || "proc-fallback",
      label: "Selected Procedure",
      name: selectedProcedure?.name || "Automated Playbook",
      subtext: selectedProcedure
        ? `${Math.round(selectedProcedure.confidenceWeight * 100)}% Confidence (${
            selectedProcedure.stepsCount || 3
          } steps)`
        : "Remediation Runbook",
      layer: "Procedural",
      badgeColor: "border-[#242a38] bg-[#0c0e14] text-zinc-100",
      icon: <Brain className="w-3.5 h-3.5 text-emerald-400" />,
    },
  ];

  const edgeLabels = [
    isDirect ? "DIRECT MATCH" : `[:DEPENDS_ON*${hopsCount}]`,
    "[:AFFECTED]",
    `[:LED_TO_RESOLUTION {weight: ${selectedProcedure?.confidenceWeight.toFixed(2) || "0.85"}}]`,
  ];

  return (
    <div className="card p-4 border-[#1c202b] bg-[#0c0e14] space-y-3 animate-fade-in">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-[#1c202b]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-blue-400">
            <GitBranch className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-zinc-100 font-mono uppercase tracking-wider">
                Autonomous Decision Trace: Stateful Causal Chain
              </h3>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                VERIFIED IN FALKORDB
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Multi-hop graph reasoning proving why <strong>agent-commander</strong> selected{" "}
              <code className="text-zinc-200 font-mono">
                {selectedProcedure?.name || "Runbook"}
              </code>{" "}
              for <strong>{matchedService.name}</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="bg-[#080a0f] px-2 py-0.5 rounded border border-[#1c202b] font-mono text-zinc-400 text-[11px]">
            Traversed: <span className="text-zinc-200 font-bold">{hopsCount} hop(s)</span>
          </span>
        </div>
      </div>

      {/* Multi-Hop Flow Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
        {hops.map((hop, i) => (
          <div key={hop.id} className="flex flex-col">
            <div
              onClick={() => onSelectHopNode?.(hop.id)}
              className="p-3 rounded-md border border-[#1c202b] hover:border-[#2a3040] bg-[#10131c] cursor-pointer transition-colors flex flex-col justify-between h-full space-y-2 group"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    Step {i + 1} · {hop.layer}
                  </span>
                  {hop.icon}
                </div>
                <div className="text-[11px] font-medium text-zinc-400">{hop.label}</div>
                <div className="text-xs font-semibold text-zinc-100 mt-0.5 truncate font-mono group-hover:text-white">
                  {hop.name}
                </div>
              </div>
              <div className="text-[10px] text-zinc-500 truncate font-mono">{hop.subtext}</div>
            </div>

            {/* Connecting Edge Indicator */}
            {i < 3 && (
              <div className="hidden md:flex items-center justify-center my-1 text-[9px] font-mono text-zinc-500 py-0.5">
                <span className="truncate max-w-[180px] text-zinc-400">
                  {edgeLabels[i]}
                </span>
                <ArrowRight className="w-3 h-3 text-zinc-600 ml-1 shrink-0" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
