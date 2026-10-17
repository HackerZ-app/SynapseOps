/**
 * SynapseOps — "Show the Path Behind an Answer" Decision Path Visualizer
 *
 * Fulfills the core Graph Hacks Hackathon requirement:
 * "Show the path behind an answer — Build an agent that makes decisions you can trace."
 *
 * Renders an explicit multi-hop causal graph proof chain connecting:
 *   [Symptomatic Service]
 *     ──[:DEPENDS_ON* (shortestPath)]──>
 *   [Root Cause Service]
 *     <──[:AFFECTED]──
 *   [Recalled Past Episode (Session ID)]
 *     ──[:LED_TO_RESOLUTION {weight}]──>
 *   [Selected Remediation Runbook]
 */

import React from 'react';
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
  Sparkles,
  Zap,
} from 'lucide-react';

export interface DecisionHop {
  id: string;
  label: 'Symptom Service' | 'Root Cause Service' | 'Recalled Episode' | 'Selected Procedure';
  name: string;
  subtext: string;
  layer: 'Semantic' | 'Episodic' | 'Procedural';
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
      label: 'Symptom Service',
      name: matchedService.name,
      subtext: `Observed Failure Zone (${matchedService.tier || 'critical'})`,
      layer: 'Semantic',
      badgeColor: 'border-cyan-500/40 bg-cyan-950/30 text-cyan-300',
      icon: <Server className="w-4 h-4 text-cyan-400" />,
    },
    {
      id: rootCauseService.id,
      label: 'Root Cause Service',
      name: rootCauseService.name,
      subtext: isDirect ? 'Direct Local Failure' : `Downstream Origin (${hopsCount} hops away)`,
      layer: 'Semantic',
      badgeColor: 'border-rose-500/40 bg-rose-950/30 text-rose-300',
      icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
    },
    {
      id: recalledEpisode?.id || 'ep-fallback',
      label: 'Recalled Episode',
      name: recalledEpisode ? `${recalledEpisode.id} (Session ${recalledEpisode.sessionId})` : 'Prior Incident Memory',
      subtext: recalledEpisode?.rootCause || 'Cross-Session Pattern Recall',
      layer: 'Episodic',
      badgeColor: 'border-purple-500/40 bg-purple-950/30 text-purple-300',
      icon: <History className="w-4 h-4 text-purple-400" />,
    },
    {
      id: selectedProcedure?.procedureId || 'proc-fallback',
      label: 'Selected Procedure',
      name: selectedProcedure?.name || 'Automated Playbook',
      subtext: selectedProcedure
        ? `${(selectedProcedure.confidenceWeight * 100).toFixed(0)}% Confidence (${selectedProcedure.stepsCount || 4} steps)`
        : 'Remediation Runbook',
      layer: 'Procedural',
      badgeColor: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300',
      icon: <Brain className="w-4 h-4 text-emerald-400" />,
    },
  ];

  const edgeLabels = [
    isDirect ? 'DIRECT MATCH' : `[:DEPENDS_ON*${hopsCount}] (shortestPath)`,
    '[:AFFECTED] (Episodic Recall)',
    `[:LED_TO_RESOLUTION {weight: ${selectedProcedure?.confidenceWeight || 0.86}}]`,
  ];

  return (
    <div className="card p-5 border-[var(--accent-blue)]/50 bg-gradient-to-r from-[var(--bg-card)] via-[var(--bg-elevated)] to-[var(--bg-card)] relative overflow-hidden shadow-xl animate-fade-in">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/30">
            <GitBranch className="w-4 h-4 text-[var(--accent-blue)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Graph Hacks Decision Trace: <span className="text-[var(--accent-cyan)]">Path Behind the Answer</span>
              </h3>
              <span className="badge badge-emerald text-[10px] py-0.5">Verifiable OpenCypher Chain</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Multi-hop graph reasoning proving why <strong>agent-commander</strong> selected{' '}
              <code className="text-[var(--accent-cyan)] font-mono">{selectedProcedure?.name || 'Runbook'}</code> for{' '}
              <strong>{matchedService.name}</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="bg-[var(--bg-primary)] px-2.5 py-1 rounded border border-[var(--border-dim)] font-mono text-[var(--text-secondary)]">
            Traversed: <span className="text-[var(--accent-emerald)] font-bold">{hopsCount} hop(s)</span>
          </span>
        </div>
      </div>

      {/* Multi-Hop Flow Visualization */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 relative">
        {hops.map((hop, i) => (
          <div key={hop.id} className="flex flex-col relative">
            {/* Hop Card */}
            <div
              onClick={() => onSelectHopNode?.(hop.id)}
              className={`p-3 rounded-lg border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg ${hop.badgeColor} flex flex-col justify-between h-full`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                    Step {i + 1} · {hop.layer}
                  </span>
                  {hop.icon}
                </div>
                <div className="text-[11px] font-semibold opacity-75">{hop.label}</div>
                <div className="text-xs font-bold text-[var(--text-primary)] mt-0.5 truncate font-mono">
                  {hop.name}
                </div>
              </div>
              <div className="text-[10px] opacity-80 mt-2 truncate">{hop.subtext}</div>
            </div>

            {/* Connecting Edge Indicator (for steps 1, 2, 3) */}
            {i < 3 && (
              <div className="hidden md:flex items-center justify-center my-1 text-[10px] font-mono text-[var(--text-muted)] py-0.5">
                <span className="truncate max-w-[190px] text-center text-[var(--accent-cyan)]/80">
                  {edgeLabels[i]}
                </span>
                <ArrowRight className="w-3 h-3 text-[var(--accent-blue)] ml-1 shrink-0" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
