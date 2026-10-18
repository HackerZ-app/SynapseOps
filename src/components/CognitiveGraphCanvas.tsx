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
  Flame,
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
  onSimulateIncident?: (serviceId: string, serviceName: string) => void;
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
  onSimulateIncident,
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
  const [hideGranularNodes, setHideGranularNodes] = useState(true);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | number | null>(null);
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

    const width = 880;
    const height = 560;
    const centerX = width / 2;
    const centerY = height / 2;
    const paddingX = 95;

    const newPositions: Record<string | number, { x: number; y: number }> = {};

    const layoutNodes = hideGranularNodes
      ? nodes.filter((n) => !n.labels.includes('Turn') && !n.labels.includes('Step'))
      : nodes;

    // Group by layer for concentric ring layout
    const semanticNodes = layoutNodes.filter((n) => getNodeLayer(n.labels) === 'semantic');
    const episodicNodes = layoutNodes.filter((n) => getNodeLayer(n.labels) === 'episodic');
    const proceduralNodes = layoutNodes.filter((n) => getNodeLayer(n.labels) === 'procedural');
    const coordNodes = layoutNodes.filter((n) => getNodeLayer(n.labels) === 'coordination');

    // Ring 1: Semantic (Center-Left) with staggered Y-offsets
    semanticNodes.forEach((node, i) => {
      const angle = (i / Math.max(semanticNodes.length, 1)) * Math.PI * 2;
      const radius = 125;
      const yOffset = i % 2 === 0 ? -24 : 24;
      const rawX = centerX - 150 + Math.cos(angle) * radius;
      const rawY = centerY + 10 + Math.sin(angle) * (radius * 0.78) + yOffset;
      newPositions[node.id] = {
        x: Math.max(paddingX, Math.min(width - paddingX, rawX)),
        y: Math.max(45, Math.min(height - 45, rawY)),
      };
    });

    // Ring 2: Procedural (Center-Right) with staggered Y-offsets
    proceduralNodes.forEach((node, i) => {
      const angle = (i / Math.max(proceduralNodes.length, 1)) * Math.PI * 2;
      const radius = 140;
      const yOffset = i % 2 === 0 ? -24 : 24;
      const rawX = centerX + 165 + Math.cos(angle) * radius;
      const rawY = centerY + 10 + Math.sin(angle) * (radius * 0.82) + yOffset;
      newPositions[node.id] = {
        x: Math.max(paddingX, Math.min(width - paddingX, rawX)),
        y: Math.max(45, Math.min(height - 45, rawY)),
      };
    });

    // Ring 3: Episodic (Bottom Arc) with staggered Y-offsets
    episodicNodes.forEach((node, i) => {
      const count = Math.max(episodicNodes.length, 1);
      const angle = Math.PI * 0.2 + (i / count) * Math.PI * 0.6;
      const radius = 215;
      const yOffset = i % 2 === 0 ? -24 : 24;
      const rawX = centerX + Math.cos(angle) * radius * 1.25;
      const rawY = centerY + Math.sin(angle) * radius * 0.8 + 40 + yOffset;
      newPositions[node.id] = {
        x: Math.max(paddingX, Math.min(width - paddingX, rawX)),
        y: Math.max(50, Math.min(height - 40, rawY)),
      };
    });

    // Coordination (Top Arc) - Generous horizontal spacing and safe margins
    coordNodes.forEach((node, i) => {
      const count = coordNodes.length;
      const usableWidth = width - paddingX * 2;
      const rawX = count <= 1
        ? centerX
        : paddingX + 35 + (i / (count - 1)) * (usableWidth - 70);
      const yOffset = i % 2 === 0 ? -24 : 24;
      newPositions[node.id] = {
        x: Math.max(paddingX, Math.min(width - paddingX, rawX)),
        y: 74 + yOffset,
      };
    });

    // Fallback placement for granular nodes when compact mode is toggled off
    if (!hideGranularNodes) {
      const granularNodes = nodes.filter((n) => n.labels.includes('Turn') || n.labels.includes('Step'));
      granularNodes.forEach((node, i) => {
        if (!newPositions[node.id]) {
          const angle = (i / Math.max(granularNodes.length, 1)) * Math.PI * 2;
          newPositions[node.id] = {
            x: Math.max(paddingX, Math.min(width - paddingX, centerX + Math.cos(angle) * 195)),
            y: Math.max(45, Math.min(height - 45, centerY + Math.sin(angle) * 175)),
          };
        }
      });
    }

    setNodePositions(newPositions);
  }, [nodes, hideGranularNodes]);

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

  // Fast lookup for highlighted node IDs (by internal ID or property ID)
  const highlightedNodeLookup = useMemo(() => {
    const set = new Set<string>();
    highlightedNodeIds.forEach((id) => set.add(String(id)));
    nodes.forEach((n) => {
      const propId = String((n.properties as Record<string, string>)?.id || '');
      if (set.has(propId) || set.has(String(n.id))) {
        set.add(String(n.id));
        if (propId) set.add(propId);
      }
    });
    return set;
  }, [highlightedNodeIds, nodes]);

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

  // Filtered nodes based on active layers, compact mode, and active path mode
  const visibleNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (hideGranularNodes && (n.labels.includes('Turn') || n.labels.includes('Step'))) {
        return false;
      }

      const layer = getNodeLayer(n.labels);
      if (!activeLayers[layer]) return false;

      if (showActivePathOnly && highlightedNodeIds.length > 0) {
        const idStr = String(n.id);
        const propId = String((n.properties as Record<string, string>).id || '');
        return highlightedNodeIds.includes(idStr) || highlightedNodeIds.includes(propId);
      }
      return true;
    });
  }, [nodes, activeLayers, showActivePathOnly, highlightedNodeIds, hideGranularNodes]);

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
      style={{ minHeight: '540px', cursor: isPanning ? 'grabbing' : 'default' }}
    >
      {/* ═══ Floating Controls Toolbar ═══ */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 bg-[#0c0e14]/90 backdrop-blur-md p-1 rounded-md border border-[#1c202b] shadow-lg text-xs font-mono">
        {/* Layer Filters */}
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider px-1">
          Layers:
        </span>
        <button
          onClick={() => setActiveLayers((p) => ({ ...p, semantic: !p.semantic }))}
          className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
            activeLayers.semantic ? 'bg-[#1c2233] text-cyan-300 border border-[#2d374d]' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
          }`}
        >
          Semantic
        </button>
        <button
          onClick={() => setActiveLayers((p) => ({ ...p, episodic: !p.episodic }))}
          className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
            activeLayers.episodic ? 'bg-[#1c2233] text-purple-300 border border-[#2d374d]' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
          }`}
        >
          Episodic
        </button>
        <button
          onClick={() => setActiveLayers((p) => ({ ...p, procedural: !p.procedural }))}
          className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
            activeLayers.procedural ? 'bg-[#1c2233] text-emerald-300 border border-[#2d374d]' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
          }`}
        >
          Procedural
        </button>
        <button
          onClick={() => setActiveLayers((p) => ({ ...p, coordination: !p.coordination }))}
          className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
            activeLayers.coordination ? 'bg-[#1c2233] text-amber-300 border border-[#2d374d]' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
          }`}
        >
          Agents
        </button>

        <div className="h-3.5 w-px bg-[#1c202b] mx-1" />

        {/* Compact View Toggle */}
        <button
          onClick={() => setHideGranularNodes((prev) => !prev)}
          className={`px-2 py-0.5 rounded text-[10px] transition-all flex items-center gap-1 border cursor-pointer ${
            hideGranularNodes
              ? 'bg-[#141824] text-zinc-200 border-[#242a38]'
              : 'text-zinc-500 border-transparent hover:text-zinc-300'
          }`}
          title="Filter out :Turn and :Step nodes for clean primary topology"
        >
          <Layers className="w-3 h-3 text-cyan-400" />
          {hideGranularNodes ? 'Compact Topology' : 'All Nodes'}
        </button>

        <div className="h-3.5 w-px bg-[#1c202b] mx-1" />

        {/* Active Path Toggle */}
        <button
          onClick={() => setShowActivePathOnly((prev) => !prev)}
          className={`px-2 py-0.5 rounded text-[10px] transition-all flex items-center gap-1 border cursor-pointer ${
            showActivePathOnly
              ? 'bg-[#1c2233] text-zinc-100 border-[#2d374d]'
              : 'text-zinc-500 border-transparent hover:text-zinc-300'
          }`}
          title="Filter to nodes activated in the most recent swarm incident"
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          {showActivePathOnly ? 'Reasoning Subgraph' : 'Full Graph'}
        </button>
      </div>

      {/* ═══ Zoom / Pan Controls ═══ */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-[#0c0e14]/90 backdrop-blur-md p-1 rounded-md border border-[#1c202b] shadow-lg">
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.15, 2.5))}
          className="p-1 hover:bg-[#141824] rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
          className="p-1 hover:bg-[#141824] rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="p-1 hover:bg-[#141824] rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
          title="Reset View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ═══ Interactive SVG Canvas ═══ */}
      <svg
        className="w-full h-full absolute inset-0 cursor-grab"
        style={{ width: '100%', height: '100%', minHeight: '540px' }}
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

            const isReasoningEdge =
              (highlightedNodeLookup.size > 0 &&
                highlightedNodeLookup.has(String(edge.source)) &&
                highlightedNodeLookup.has(String(edge.target))) ||
              edge.type === 'LED_TO_RESOLUTION' ||
              edge.type === 'HANDED_OFF_TO';

            const isEdgeHovered = hoveredEdgeId === edge.id;
            const showLabel = isReasoningEdge || isEdgeHovered;

            return (
              <g
                key={edge.id}
                className="transition-opacity duration-300 cursor-pointer"
                onMouseEnter={() => setHoveredEdgeId(edge.id)}
                onMouseLeave={() => setHoveredEdgeId(null)}
              >
                {/* Transparent hit area to make edge hovering comfortable */}
                <line
                  x1={srcPos.x}
                  y1={srcPos.y}
                  x2={tgtPos.x}
                  y2={tgtPos.y}
                  stroke="transparent"
                  strokeWidth={14}
                />
                <line
                  x1={srcPos.x}
                  y1={srcPos.y}
                  x2={tgtPos.x}
                  y2={tgtPos.y}
                  stroke={isEdgeHovered ? '#38bdf8' : isReasoningEdge ? '#22d3ee' : 'rgba(76, 105, 145, 0.35)'}
                  strokeWidth={isEdgeHovered ? 2.8 : isReasoningEdge ? 2.5 : 1.2}
                  strokeDasharray={edge.type === 'HANDED_OFF_TO' ? '4 3' : undefined}
                  markerEnd={isReasoningEdge || isEdgeHovered ? 'url(#arrow-active)' : 'url(#arrow)'}
                />

                {/* Animated Data Packets flowing along reasoning & handoff edges */}
                {isReasoningEdge && (
                  <circle r="3.5" fill="#22d3ee" className="pointer-events-none drop-shadow-[0_0_6px_#22d3ee]">
                    <animateMotion
                      path={`M ${srcPos.x} ${srcPos.y} L ${tgtPos.x} ${tgtPos.y}`}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                {edge.type === 'HANDED_OFF_TO' && (
                  <circle r="3.5" fill="#f59e0b" className="pointer-events-none drop-shadow-[0_0_6px_#f59e0b]">
                    <animateMotion
                      path={`M ${srcPos.x} ${srcPos.y} L ${tgtPos.x} ${tgtPos.y}`}
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Edge Type Label - only rendered for active reasoning path, handoff/resolution, or on hover */}
                {showLabel && (
                  <text
                    x={(srcPos.x + tgtPos.x) / 2}
                    y={(srcPos.y + tgtPos.y) / 2 - 4}
                    fill={isEdgeHovered ? '#38bdf8' : isReasoningEdge ? '#67e8f9' : 'rgba(148, 163, 184, 0.85)'}
                    fontSize="9"
                    textAnchor="middle"
                    fontFamily="monospace"
                    className="pointer-events-none select-none font-semibold"
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

      {/* ═══ FalkorDB Node & Edge Inspector Side Drawer ═══ */}
      {inspectedNode && (
        <div className="absolute top-3 right-3 bottom-3 w-80 bg-[#0c0e14]/95 backdrop-blur-md rounded-md border border-[#1c202b] p-3.5 shadow-2xl z-30 flex flex-col justify-between animate-slide-down text-xs">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#1c202b]">
              <div className="flex items-center gap-2 truncate">
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.2 rounded">
                  {inspectedNode.labels.join(' : ')}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  #{inspectedNode.id}
                </span>
              </div>
              <button
                onClick={() => setInspectedNode(null)}
                className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Title / Name */}
            <h4 className="text-xs font-semibold text-zinc-100 font-mono mb-2">
              {String(
                (inspectedNode.properties as Record<string, string>).name ||
                  (inspectedNode.properties as Record<string, string>).id ||
                  `Node #${inspectedNode.id}`
              )}
            </h4>

            {/* If node is a Service, offer 1-click simulate incident */}
            {inspectedNode.labels.includes('Service') && onSimulateIncident && (
              <button
                onClick={() => {
                  const sId = String(
                    (inspectedNode.properties as Record<string, string>).id || inspectedNode.id
                  );
                  const sName = String(
                    (inspectedNode.properties as Record<string, string>).name || sId
                  );
                  onSimulateIncident(sId, sName);
                }}
                className="w-full mb-3 py-1.5 px-3 rounded border border-rose-500/30 bg-rose-950/20 text-xs font-mono font-medium text-rose-300 hover:bg-rose-950/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                Simulate Incident on This Service
              </button>
            )}

            {/* Properties List */}
            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider block mb-1">
                FalkorDB Node Properties:
              </span>
              {Object.entries(inspectedNode.properties || {}).map(([k, v]) => (
                <div
                  key={k}
                  className="bg-[#080a0f] p-1.5 rounded border border-[#1c202b] font-mono text-[10px]"
                >
                  <span className="text-zinc-500">{k}: </span>
                  <span className="text-zinc-200 font-medium whitespace-pre-wrap break-all">
                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Close */}
          <div className="pt-2.5 border-t border-[#1c202b] flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>LAYER: {getNodeLayer(inspectedNode.labels).toUpperCase()}</span>
            <button
              onClick={() => setInspectedNode(null)}
              className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
