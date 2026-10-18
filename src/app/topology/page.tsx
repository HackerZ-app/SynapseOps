"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Network,
  Server,
  Brain,
  History,
  Workflow,
  Database,
} from "lucide-react";
import { useSynapse } from "@/context/SynapseContext";
import CognitiveGraphCanvas from "@/components/CognitiveGraphCanvas";

export default function TopologyPage() {
  const router = useRouter();
  const {
    tenantId,
    inspectData,
    canvasNodes,
    canvasEdges,
    highlightedNodeIds,
    selectedHopNodeId,
    setSelectedHopNodeId,
    setAlertText,
  } = useSynapse();

  const counts = inspectData?.counts;
  const activeGraphKey =
    inspectData?.graphName || `synapse_tenant_${tenantId.replace("-", "_")}`;

  return (
    <div className="p-4 flex flex-col h-[calc(100vh-3.5rem)] space-y-3 animate-fade-in select-none">
      {/* ═══ Explorer Header Bar ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c0e14] p-3 rounded-md border border-[#1c202b] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-[#10131c] border border-[#1c202b] flex items-center justify-center text-zinc-300">
            <Network className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-zinc-100 font-mono uppercase tracking-wider">
                Service Multigraph Topology Explorer
              </h2>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.2 rounded tabular-nums">
                {canvasNodes.length} Nodes · {canvasEdges.length} Edges
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.2 rounded hidden sm:inline-flex">
                FalkorDB v4.x
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Interactive 4-layer graph architecture · Select any node to inspect properties & causal relationships
            </p>
          </div>
        </div>

        {/* Layer Breakdown Badges (Linear-style muted pills) */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 text-zinc-300 text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            {counts?.services ?? 0} Services
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 text-zinc-300 text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            {counts?.episodes ?? 0} Episodes
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 text-zinc-300 text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {counts?.procedures ?? 0} Runbooks
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 text-zinc-300 text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {counts?.agents ?? 3} Agents
          </span>
        </div>
      </div>

      {/* ═══ Full-Viewport Interactive Cognitive Graph Canvas ═══ */}
      <div className="flex-1 w-full relative rounded-md overflow-hidden border border-[#1c202b] bg-[#080a0f]">
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
          onSimulateIncident={(serviceId, serviceName) => {
            setAlertText(
              `Critical outage and latency spike detected on ${serviceName} (${serviceId}). Investigating cascade blast radius.`
            );
            router.push("/war-room");
          }}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
