/**
 * SynapseOps — Interactive Cognitive Graph Canvas
 *
 * High-performance, zero-external-dependency interactive SVG Graph Visualizer.
 * Renders live topology.nodes and topology.edges fetched from FalkorDB.
 *
 * Features:
 *   1. 4-Layer Visual Encoding:
 *      - Semantic (Cyan/Blue #06b6d4 / #3b82f6)
 *      - Episodic (Purple/Violet #a855f7 / #8b5cf6)
 *      - Procedural (Emerald/Green #10b981 / #059669)
 *      - Coordination (Amber/Orange #f59e0b / #f97316)
 *   2. Active Reasoning Subgraph Highlighting with Glow & Dimming
 *   3. Interactive Zoom, Pan, Drag-to-Reposition, and Layer Filters
 *   4. FalkorDB Node Inspector side drawer with raw properties & relationships
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Eye,
  Layers,
  Sparkles,
  X,
  Info,
  Server,
  Brain,
  History,
  Workflow,
  Shield,
  ArrowRight,
} from 'lucide-react';

export interface GraphNode {
  id: number | string;
  labels: string[];
  properties: Record<string, unknown>;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: number | string;
  source: number | string;
  target: number | string;
  type: string;
  properties: Record<string, unknown>;
}

interface CognitiveGraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  highlightedNodeIds?: string[];
  highlightedEdgeTypes?: string[];
  onSelectNode?: (node: GraphNode | null) => void;
  selectedNodeId?: string | number | null;
  className?: string;
}

// ─── Layer Color Helpers ───────────────────────────────────────────────────

function getNodeLayer(labels: string[]): 'semantic' | 'episodic' | 'procedural' | 'coordination' {
  if (labels.includes('Service') || labels.includes('Team')) return 'semantic';
  if (labels.includes('Episode') || labels.includes('Session') || labels.includes('Turn')) return 'episodic';
  if (labels.includes('Procedure') || labels.includes('Step')) return 'procedural';
  return 'coordination';
}

function getNodeColor(labels: string[], isHighlighted: boolean, isDimmed: boolean) {
  if (isDimmed) return '#263143';

  if (labels.includes('Service')) return '#06b6d4'; // Cyan
  if (labels.includes('Team')) return '#3b82f6'; // Blue
  if (labels.includes('Episode')) return '#a855f7'; // Purple
  if (labels.includes('Session') || labels.includes('Turn')) return '#8b5cf6'; // Violet
  if (labels.includes('Procedure')) return '#10b981'; // Emerald
  if (labels.includes('Step')) return '#059669'; // Green
  if (labels.includes('Agent')) return '#f59e0b'; // Amber
  if (labels.includes('TaskState')) return '#f97316'; // Orange
  return '#94a3b8';
}

function getNodeRadius(labels: string[]): number {
  if (labels.includes('Service')) return 22;
  if (labels.includes('Procedure')) return 20;
  if (labels.includes('Episode')) return 18;
  if (labels.includes('Agent')) return 20;
  if (labels.includes('Team')) return 16;
  if (labels.includes('TaskState')) return 16;
  return 14;
}

export default function CognitiveGraphCanvas({
  nodes,
  edges,
  highlightedNodeIds = [],
  highlightedEdgeTypes = [],
  onSelectNode,
  selectedNodeId,
  className = '',
}: CognitiveGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport transform (Pan & Zoom)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Dragging individual nodes
  const [draggingNodeId, setDraggingNodeId] = useState<string | number | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string | number, { x: number; y: number }>>({});

  // Filters & Modes
  const [showActivePathOnly, setShowActivePathOnly] = useState(false);
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({
    semantic: true,
    episodic: true,
    procedural: true,
    coordination: true,
  });

  // Selected Node for Drawer
  const [inspectedNode, setInspectedNode] = useState<GraphNode | null>(null);

  // Initialize smart layout positions
  useEffect(() => {
    if (nodes.length === 0) return;

    const width = 860;
    const height = 540;
    const centerX = width / 2;
    const centerY = height / 2;

    const newPositions: Record<string | number, { x: number; y: number }> = {};

    // Group by layer for concentric ring layout
    const semanticNodes = nodes.filter((n) => getNodeLayer(n.labels) === 'semantic');
    const episodicNodes = nodes.filter((n) => getNodeLayer(n.labels) === 'episodic');
    const proceduralNodes = nodes.filter((n) => getNodeLayer(n.labels) === 'procedural');
    const coordNodes = nodes.filter((n) => getNodeLayer(n.labels) === 'coordination');

    // Ring 1: Semantic (Center-Left)
    semanticNodes.forEach((node, i) => {
      const angle = (i / Math.max(semanticNodes.length, 1)) * Math.PI * 2;
      const radius = 130;
      newPositions[node.id] = {
        x: centerX - 140 + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * (radius * 0.8),
      };
    });

    // Ring 2: Procedural (Center-Right)
    proceduralNodes.forEach((node, i) => {
      const angle = (i / Math.max(proceduralNodes.length, 1)) * Math.PI * 2;
      const radius = 150;
      newPositions[node.id] = {
        x: centerX + 180 + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * (radius * 0.85),
      };
    });

    // Ring 3: Episodic (Bottom Arc)
    episodicNodes.forEach((node, i) => {
      const angle = Math.PI * 0.2 + (i / Math.max(episodicNodes.length, 1)) * Math.PI * 0.6;
      const radius = 220;
      newPositions[node.id] = {
        x: centerX + Math.cos(angle) * radius * 1.3,
        y: centerY + Math.sin(angle) * radius * 0.85 + 30,
      };
    });

    // Coordination (Top Arc)
    coordNodes.forEach((node, i) => {
      const xSpread = 160;
      newPositions[node.id] = {
        x: centerX + (i - (coordNodes.length - 1) / 2) * xSpread,
        y: 60 + (i % 2) * 40,
      };
    });

    setNodePositions(newPositions);
  }, [nodes]);

  // Sync selectedNodeId prop with inspectedNode
  useEffect(() => {
    if (selectedNodeId !== undefined && selectedNodeId !== null) {
      const found = nodes.find(
        (n) =>
          String(n.id) === String(selectedNodeId) ||
          String((n.properties as Record<string, string>).id) === String(selectedNodeId)
      );
      if (found) setInspectedNode(found);
    }
  }, [selectedNodeId, nodes]);

  // Handle node selection
  const handleNodeClick = (node: GraphNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setInspectedNode(node);
    onSelectNode?.(node);
  };

  // Node position helper
  const getNodePos = useCallback(
    (id: string | number) => {
      return nodePositions[id] || { x: 400, y: 300 };
    },
    [nodePositions]
  );

  // Mouse handlers for Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    } else if (draggingNodeId !== null) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      setNodePositions((prev) => ({
        ...prev,
        [draggingNodeId]: { x, y },
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // Filtered nodes based on active layers and active path mode
  const visibleNodes = useMemo(() => {
    return nodes.filter((n) => {
      const layer = getNodeLayer(n.labels);
      if (!activeLayers[layer]) return false;

      if (showActivePathOnly && highlightedNodeIds.length > 0) {
        const idStr = String(n.id);
        const propId = String((n.properties as Record<string, string>).id || '');
        return highlightedNodeIds.includes(idStr) || highlightedNodeIds.includes(propId);
      }
      return true;
    });
  }, [nodes, activeLayers, showActivePathOnly, highlightedNodeIds]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => String(n.id))), [visibleNodes]);

  // Filtered edges connecting visible nodes
  const visibleEdges = useMemo(() => {
    return edges.filter((e) => {
      return visibleNodeIds.has(String(e.source)) && visibleNodeIds.has(String(e.target));
    });
  }, [edges, visibleNodeIds]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`card relative overflow-hidden select-none bg-[var(--bg-primary)] border-[var(--border-dim)] ${className}`}
      style={{ minHeight: '520px', cursor: isPanning ? 'grabbing' : 'default' }}
    >
      {/* ═══ Floating Controls Toolbar ═══ */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 bg-[var(--bg-card)]/90 backdrop-blur-md p-1.5 rounded-lg border border-[var(--border-dim)] shadow-lg text-xs">
        {/* Layer Filters */}
        <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider px-1">
          Layers:
        </span>
        <button
          onClick={() => setActiveLayers((p) => ({ ...p, semantic: !p.semantic }))}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
            activeLayers.semantic ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-[var(--text-muted)]'
          }`}
        >
          Semantic
        </button>
        <button
          onClick={() => setActiveLayers((p) => ({ ...p, episodic: !p.episodic }))}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
            activeLayers.episodic ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' : 'text-[var(--text-muted)]'
          }`}
        >
          Episodic
        </button>
        <button
          onClick={() => setActiveLayers((p) => ({ ...p, procedural: !p.procedural }))}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
            activeLayers.procedural ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-[var(--text-muted)]'
          }`}
        >
          Procedural
        </button>
        <button
          onClick={() => setActiveLayers((p) => ({ ...p, coordination: !p.coordination }))}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
            activeLayers.coordination ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-[var(--text-muted)]'
          }`}
        >
          Agents
        </button>

        <div className="h-4 w-px bg-[var(--border-dim)] mx-1" />

        {/* Active Path Toggle */}
        <button
          onClick={() => setShowActivePathOnly((prev) => !prev)}
          className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 ${
            showActivePathOnly
              ? 'bg-[var(--accent-blue)] text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          title="Filter to nodes activated in the most recent swarm incident"
        >
          <Sparkles className="w-3 h-3 text-[var(--accent-amber)]" />
          {showActivePathOnly ? 'Reasoning Path Only' : 'Full Tenant Graph'}
        </button>
      </div>

      {/* ═══ Zoom / Pan Controls ═══ */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-[var(--bg-card)]/90 backdrop-blur-md p-1 rounded-lg border border-[var(--border-dim)] shadow-lg">
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.15, 2.5))}
          className="p-1.5 hover:bg-[var(--bg-elevated)] rounded text-[var(--text-secondary)]"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
          className="p-1.5 hover:bg-[var(--bg-elevated)] rounded text-[var(--text-secondary)]"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="p-1.5 hover:bg-[var(--bg-elevated)] rounded text-[var(--text-secondary)]"
          title="Reset View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* ═══ Interactive SVG Canvas ═══ */}
      <svg
        className="w-full h-full absolute inset-0 cursor-grab"
        style={{ width: '100%', height: '100%', minHeight: '520px' }}
      >
        <defs>
          {/* Arrow markers */}
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(86, 118, 162, 0.6)" />
          </marker>
          <marker
            id="arrow-active"
            viewBox="0 0 10 10"
            refX="24"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#22d3ee" />
          </marker>
          {/* Node Glow Filters */}
          <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {visibleEdges.map((edge) => {
            const srcPos = getNodePos(edge.source);
            const tgtPos = getNodePos(edge.target);

            const isEdgeHighlighted =
              highlightedEdgeTypes.length > 0 && highlightedEdgeTypes.includes(edge.type);

            return (
              <g key={edge.id} className="transition-opacity duration-300">
                <line
                  x1={srcPos.x}
                  y1={srcPos.y}
                  x2={tgtPos.x}
                  y2={tgtPos.y}
                  stroke={isEdgeHighlighted ? '#22d3ee' : 'rgba(76, 105, 145, 0.35)'}
                  strokeWidth={isEdgeHighlighted ? 2.5 : 1.2}
                  strokeDasharray={edge.type === 'HANDED_OFF_TO' ? '4 3' : undefined}
                  markerEnd={isEdgeHighlighted ? 'url(#arrow-active)' : 'url(#arrow)'}
                />
                {/* Edge Type Label */}
                {(isEdgeHighlighted || edge.type === 'LED_TO_RESOLUTION' || edge.type === 'HANDED_OFF_TO') && (
                  <text
                    x={(srcPos.x + tgtPos.x) / 2}
                    y={(srcPos.y + tgtPos.y) / 2 - 4}
                    fill={isEdgeHighlighted ? '#67e8f9' : 'rgba(148, 163, 184, 0.7)'}
                    fontSize="9"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {edge.type === 'LED_TO_RESOLUTION' && edge.properties?.confidence_weight
                      ? `${edge.type} (${edge.properties.confidence_weight})`
                      : edge.type}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {visibleNodes.map((node) => {
            const pos = getNodePos(node.id);
            const radius = getNodeRadius(node.labels);
            const isHighlighted =
              highlightedNodeIds.includes(String(node.id)) ||
              highlightedNodeIds.includes(String((node.properties as Record<string, string>).id || ''));
            const isDimmed = showActivePathOnly && !isHighlighted;
            const isSelected =
              inspectedNode?.id === node.id ||
              String((inspectedNode?.properties as Record<string, string>)?.id) === String(node.id);
            const color = getNodeColor(node.labels, isHighlighted, isDimmed);

            const labelText =
              (node.properties as Record<string, string>).name ||
              (node.properties as Record<string, string>).id ||
              node.labels[0];

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={(e) => handleNodeClick(node, e)}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggingNodeId(node.id);
                }}
                className="cursor-pointer group"
              >
                {/* Outer Glow for Highlighted Active Path */}
                {isHighlighted && (
                  <circle
                    r={radius + 8}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    opacity="0.4"
                    className="animate-pulse"
                  />
                )}

                {/* Selected Node Ring */}
                {isSelected && (
                  <circle
                    r={radius + 5}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    strokeDasharray="3 2"
                  />
                )}

                {/* Main Node Body */}
                <circle
                  r={radius}
                  fill={color}
                  stroke={isSelected ? '#ffffff' : isHighlighted ? '#ffffff' : 'rgba(255, 255, 255, 0.2)'}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  filter={isHighlighted ? 'url(#glow-cyan)' : undefined}
                  className="transition-transform duration-200 group-hover:scale-110"
                />

                {/* Node Inner Label / Icon text */}
                <text
                  dy="4"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="bold"
                  pointerEvents="none"
                  className="select-none"
                >
                  {node.labels[0]?.slice(0, 3).toUpperCase()}
                </text>

                {/* Node Name Subtitle */}
                <text
                  dy={radius + 13}
                  textAnchor="middle"
                  fill={isDimmed ? '#475569' : '#e2e8f0'}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="500"
                  pointerEvents="none"
                  className="select-none"
                >
                  {String(labelText).length > 16 ? `${String(labelText).slice(0, 14)}…` : String(labelText)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* ═══ FalkorDB Node Inspector Side Drawer ═══ */}
      {inspectedNode && (
        <div className="absolute top-3 right-3 bottom-3 w-80 bg-[var(--bg-card)]/95 backdrop-blur-md rounded-xl border border-[var(--border-subtle)] p-4 shadow-2xl z-30 flex flex-col justify-between animate-slide-down text-xs">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--border-dim)]">
              <div className="flex items-center gap-2 truncate">
                <span className="badge badge-blue text-[10px] py-0 px-2">
                  {inspectedNode.labels.join(' : ')}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">
                  #{inspectedNode.id}
                </span>
              </div>
              <button
                onClick={() => setInspectedNode(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title / Name */}
            <h4 className="text-sm font-bold text-[var(--text-primary)] font-mono mb-2">
              {String(
                (inspectedNode.properties as Record<string, string>).name ||
                  (inspectedNode.properties as Record<string, string>).id ||
                  `Node #${inspectedNode.id}`
              )}
            </h4>

            {/* Properties List */}
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
              <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider block">
                FalkorDB Properties:
              </span>
              {Object.entries(inspectedNode.properties || {}).map(([k, v]) => (
                <div
                  key={k}
                  className="bg-[var(--bg-primary)] p-2 rounded border border-[var(--border-dim)] font-mono text-[11px]"
                >
                  <span className="text-[var(--text-muted)]">{k}: </span>
                  <span className="text-[var(--accent-cyan)] font-medium whitespace-pre-wrap break-all">
                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Close */}
          <div className="pt-3 border-t border-[var(--border-dim)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Layer: {getNodeLayer(inspectedNode.labels).toUpperCase()}</span>
            <button
              onClick={() => setInspectedNode(null)}
              className="px-2 py-1 rounded bg-[var(--bg-elevated)] hover:bg-[var(--bg-primary)] text-[var(--text-primary)]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
