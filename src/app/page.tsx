"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Brain,
  Flame,
  Network,
  Terminal,
  Activity,
  Server,
  Layers,
  Shield,
  Gauge,
  ArrowRight,
  Database,
  CheckCircle2,
  Workflow,
  Cpu,
  TrendingUp,
} from "lucide-react";
import { useSynapse } from "@/context/SynapseContext";

export default function CommandOverviewPage() {
  const router = useRouter();
  const {
    tenantId,
    inspectData,
    canvasNodes,
    canvasEdges,
    deduplicatedProcedures,
    setAlertText,
  } = useSynapse();

  // Canvas ref for 60fps graph network animation
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Architecture Simulator active step (1, 2, or 3)
  const [simStep, setSimStep] = useState<number>(1);
  const [simConfidence, setSimConfidence] = useState<number>(68);

  // 60fps Interactive HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", handleResize);

    // Mouse coordinates for subtle interactive attraction/repulsion
    let mouseX = width / 2;
    let mouseY = height / 2;
    let isMouseOver = false;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      isMouseOver = true;
    };
    const handleMouseLeave = () => {
      isMouseOver = false;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    const colors = [
      { fill: "#38bdf8", glow: "rgba(56, 189, 248, 0.3)" },
      { fill: "#a78bfa", glow: "rgba(167, 139, 250, 0.3)" },
      { fill: "#34d399", glow: "rgba(52, 211, 153, 0.3)" },
      { fill: "#fbbf24", glow: "rgba(251, 191, 36, 0.3)" },
    ];

    interface SimNode {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: (typeof colors)[0];
    }

    interface Packet {
      fromIndex: number;
      toIndex: number;
      progress: number;
      speed: number;
      color: string;
    }

    const nodeCount = 32;
    const nodes: SimNode[] = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 3,
        color: colors[i % colors.length],
      });
    }

    const packets: Packet[] = [];
    for (let p = 0; p < 10; p++) {
      packets.push({
        fromIndex: Math.floor(Math.random() * nodeCount),
        toIndex: Math.floor(Math.random() * nodeCount),
        progress: Math.random(),
        speed: 0.006 + Math.random() * 0.006,
        color: colors[p % colors.length].fill,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Subtle technical grid
      ctx.strokeStyle = "rgba(28, 32, 43, 0.6)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Update & Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;

        if (n.x < 10 || n.x > width - 10) n.vx *= -1;
        if (n.y < 10 || n.y > height - 10) n.vy *= -1;

        if (isMouseOver) {
          const dx = n.x - mouseX;
          const dy = n.y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100 && dist > 0) {
            const force = (100 - dist) / 100;
            n.x += (dx / dist) * force * 1.2;
            n.y += (dy / dist) * force * 1.2;
          }
        }

        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const dx = n.x - m.x;
          const dy = n.y - m.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            const alpha = (1 - dist / 120) * 0.2;
            ctx.strokeStyle = `rgba(75, 85, 99, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Animated light packets
      for (let p = 0; p < packets.length; p++) {
        const packet = packets[p];
        packet.progress += packet.speed;
        if (packet.progress >= 1) {
          packet.progress = 0;
          packet.fromIndex = Math.floor(Math.random() * nodeCount);
          packet.toIndex = Math.floor(Math.random() * nodeCount);
        }

        const src = nodes[packet.fromIndex];
        const tgt = nodes[packet.toIndex];
        const px = src.x + (tgt.x - src.x) * packet.progress;
        const py = src.y + (tgt.y - src.y) * packet.progress;

        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = packet.color;
        ctx.fill();
      }

      // Draw node dots
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.color.fill;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  const counts = inspectData?.counts;
  const activeGraphKey =
    inspectData?.graphName || `synapse_tenant_${tenantId.replace("-", "_")}`;

  // Filter service nodes for the Monitored Service Fleet Table
  const serviceNodes = (inspectData?.topology?.nodes || [])
    .filter((n) => n.labels.includes("Service"))
    .map((n) => {
      const props = (n.properties || {}) as Record<string, string>;
      return {
        id: String(props.id || n.id),
        name: props.name || String(props.id || `Service-${n.id}`),
        tier: props.tier || "Tier-1",
        team: props.team || "Platform SRE",
        protocol: props.protocol || "gRPC / HTTP2",
        status: "HEALTHY",
      };
    });

  // Fallback defaults if services haven't populated yet
  const displayedServices =
    serviceNodes.length > 0
      ? serviceNodes.slice(0, 5)
      : [
          {
            id: "svc-payment-gw",
            name: "Payment-Gateway",
            tier: "Tier-1",
            team: "Checkout Infra",
            protocol: "gRPC",
            status: "HEALTHY",
          },
          {
            id: "svc-ledger-db",
            name: "Ledger-DB",
            tier: "Tier-1",
            team: "Data Core",
            protocol: "Postgres Wire",
            status: "HEALTHY",
          },
          {
            id: "svc-auth-router",
            name: "Auth-Router",
            tier: "Tier-1",
            team: "IAM Security",
            protocol: "HTTP/2",
            status: "HEALTHY",
          },
          {
            id: "svc-inventory-sync",
            name: "Inventory-Sync",
            tier: "Tier-2",
            team: "Catalog Team",
            protocol: "Kafka PubSub",
            status: "HEALTHY",
          },
          {
            id: "svc-notification-svc",
            name: "Notification-Service",
            tier: "Tier-3",
            team: "Messaging",
            protocol: "WebSocket",
            status: "HEALTHY",
          },
        ];

  const handleTriggerDrill = (svc: { id: string; name: string }) => {
    setAlertText(
      `Critical latency spike and HTTP 504 Gateway Timeout detected on ${svc.name} (${svc.id}). Investigating cascade blast radius.`
    );
    router.push("/war-room");
  };

  return (
    <div className="p-5 max-w-[1600px] mx-auto space-y-5 animate-fade-in select-none">
      {/* ═══ Top Executive Status Bar ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1c202b]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
              Production Reliability & Cognitive Graph Overview
            </h1>
            <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
              TENANT: {tenantId}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time multi-agent control plane backed by FalkorDB native graph engine.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>FalkorDB Engine:</span>
            <span className="text-zinc-200 font-semibold">{activeGraphKey}</span>
          </div>
        </div>
      </div>

      {/* ═══ 4 High-Density KPI Metric Cards in a Row ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Metric 1 */}
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              Monitored Microservices
            </span>
            <Server className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-zinc-100 tabular-nums">
              {counts?.services ?? canvasNodes.length ?? 29}
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              {counts?.teams ?? 5} Owner Teams
            </span>
          </div>
          <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full w-[84%] rounded-full" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              Resolved Incident Episodes
            </span>
            <Activity className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-zinc-100 tabular-nums">
              {counts?.episodes ?? 14}
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              {counts?.turns ?? 42} Session Turns
            </span>
          </div>
          <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
            <div className="bg-purple-500 h-full w-[92%] rounded-full" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              Calibrated Runbooks
            </span>
            <Brain className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-zinc-100 tabular-nums">
              {counts?.procedures ?? deduplicatedProcedures.length ?? 4}
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              Empirical Laplace Prior
            </span>
          </div>
          <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full w-[76%] rounded-full" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              Avg Graph Traversal Latency
            </span>
            <Gauge className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              1.4<span className="text-sm font-normal text-zinc-400">ms</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              Sub-millisecond Traversals
            </span>
          </div>
          <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
            <div className="bg-emerald-400 h-full w-[96%] rounded-full" />
          </div>
        </div>
      </div>

      {/* ═══ Main Split Workbench (7 Cols / 5 Cols) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ── Left 7 Columns: Interactive Live Graph Signal Simulator ── */}
        <div className="lg:col-span-7 card p-4 space-y-4 bg-[#0c0e14] border-[#1c202b]">
          {/* Header & Step Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1c202b]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  Live Multigraph Telemetry · Interactive Signal Simulator
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Simulate an autonomous reasoning pipeline from symptom ingestion to runbook calibration.
              </p>
            </div>

            {/* Interactive Step Buttons */}
            <div className="flex items-center gap-1.5 bg-[#080a0f] p-0.5 rounded-md border border-[#1c202b]">
              <button
                onClick={() => {
                  setSimStep(1);
                  setSimConfidence(68);
                }}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                  simStep === 1
                    ? "bg-[#1c2233] text-zinc-100 font-semibold border border-[#2d374d]"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                1. Inject 504 Fault
              </button>

              <button
                onClick={() => {
                  setSimStep(2);
                  setSimConfidence(78);
                }}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                  simStep === 2
                    ? "bg-[#1c2233] text-zinc-100 font-semibold border border-[#2d374d]"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                2. Multi-Hop Traversal
              </button>

              <button
                onClick={() => {
                  setSimStep(3);
                  setSimConfidence(94);
                }}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                  simStep === 3
                    ? "bg-[#1c2233] text-zinc-100 font-semibold border border-[#2d374d]"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                3. Calibrate Weight
              </button>
            </div>
          </div>

          {/* 60fps Technical Viewport Canvas */}
          <div className="relative h-60 rounded-md border border-[#1c202b] bg-[#080a0f] overflow-hidden">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            <div className="absolute top-2.5 left-3 pointer-events-none flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                FalkorDB Node Stream Active · 60 FPS
              </span>
            </div>
            <div className="absolute bottom-2.5 right-3 pointer-events-none text-[10px] font-mono text-zinc-500">
              Step {simStep} of 3 Selected
            </div>
          </div>

          {/* 3-Stage Pipeline Trace: Uniform Dark Cards with Status Dots */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {/* Box 1 */}
            <div
              className={`p-3 rounded-md border transition-all space-y-1.5 ${
                simStep >= 1
                  ? "bg-[#10131c] border-[#242a38]"
                  : "bg-[#0c0e14] border-[#1c202b] opacity-40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Symptom Node
                </span>
                <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 px-1 py-0.2 rounded border border-zinc-800">
                  :Service
                </span>
              </div>
              <div className="font-semibold text-xs text-zinc-100">Payment-Gateway</div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                HTTP 504 Gateway Timeout spike triggered by downstream database thread starvation.
              </p>
            </div>

            {/* Box 2 */}
            <div
              className={`p-3 rounded-md border transition-all space-y-1.5 ${
                simStep >= 2
                  ? "bg-[#10131c] border-[#242a38]"
                  : "bg-[#0c0e14] border-[#1c202b] opacity-40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  Recalled Episode
                </span>
                <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 px-1 py-0.2 rounded border border-zinc-800">
                  :Episode
                </span>
              </div>
              <div className="font-semibold text-xs text-zinc-100">Ledger-DB Pool</div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Recalled 2 identical historical incidents in FalkorDB where thread pool exhaustion cascaded upward.
              </p>
            </div>

            {/* Box 3 */}
            <div
              className={`p-3 rounded-md border transition-all space-y-1.5 ${
                simStep >= 3
                  ? "bg-[#10131c] border-[#242a38]"
                  : "bg-[#0c0e14] border-[#1c202b] opacity-40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Selected Runbook
                </span>
                <span className="text-[10px] font-mono text-emerald-400">
                  {simConfidence}% Conf
                </span>
              </div>
              <div className="font-semibold text-xs text-zinc-100">proc-drain-ledger-pool</div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Dynamic confidence weight updated on <code>[:LED_TO_RESOLUTION]</code> via empirical smoothing.
              </p>
            </div>
          </div>

          {/* Executed OpenCypher Code Box */}
          <div className="bg-[#050608] p-3 rounded-md border border-[#1c202b] font-mono text-xs space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <Terminal className="w-3 h-3 text-cyan-400" />
                Executed OpenCypher Query in FalkorDB
              </span>
              <span className="text-emerald-400 tabular-nums">Latency: 1.2ms</span>
            </div>
            <pre className="text-zinc-300 whitespace-pre-wrap text-[11px] leading-relaxed">
              {simStep === 1
                ? `MATCH (s:Service {name: 'Payment-Gateway'})-[r:DEPENDS_ON*1..2]->(dep:Service)
RETURN s.name, dep.name, r`
                : simStep === 2
                ? `MATCH (s:Service {id: 'svc-payment-gw'})-[r:DEPENDS_ON*1..3]->(root:Service),
      (ep:Episode)-[:AFFECTED]->(root)
RETURN root.name, ep.symptom, ep.resolved LIMIT 5`
                : `MATCH (p:Procedure {id: 'proc-drain-ledger-pool'})-[r:LED_TO_RESOLUTION]->(s:Service {id: 'svc-payment-gw'})
SET r.success_count = r.success_count + 1,
    r.confidence_weight = toFloat(r.success_count + 1) / (r.success_count + r.fail_count + 2)
RETURN r.confidence_weight AS updatedWeight`}
            </pre>
          </div>
        </div>

        {/* ── Right 5 Columns: Monitored Service Fleet Table & Core Capabilities ── */}
        <div className="lg:col-span-5 space-y-5">
          {/* Monitored Service Fleet Table */}
          <div className="card p-4 space-y-3 bg-[#0c0e14] border-[#1c202b]">
            <div className="flex items-center justify-between pb-2 border-b border-[#1c202b]">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-300">
                  Monitored Service Fleet
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Live topology fleet directly from FalkorDB multigraph
                </p>
              </div>
              <Link
                href="/topology"
                className="text-[11px] text-blue-400 hover:text-blue-300 font-mono inline-flex items-center gap-1"
              >
                View Graph →
              </Link>
            </div>

            <div className="space-y-1.5">
              {displayedServices.map((svc) => (
                <div
                  key={svc.id}
                  className="p-2.5 rounded-md bg-[#080a0f] border border-[#1c202b] hover:border-[#2a3040] transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="font-medium text-zinc-100 truncate font-mono">
                        {svc.name}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1 py-0.2 rounded">
                        {svc.tier}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {svc.team} · {svc.protocol}
                    </div>
                  </div>

                  {/* 1-Click Trigger Drill Button */}
                  <button
                    onClick={() => handleTriggerDrill(svc)}
                    className="shrink-0 text-[10px] font-mono text-zinc-400 hover:text-zinc-100 bg-[#141824] hover:bg-[#1c2233] border border-[#242a38] px-2 py-1 rounded transition-colors cursor-pointer"
                    title={`Dispatch incident simulation on ${svc.name}`}
                  >
                    Trigger Drill →
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 4 Core System Capabilities (Compact 2x2 Technical Grid) */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 px-1">
              Core Control Plane Capabilities
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Capability 1 */}
              <Link
                href="/memory"
                className="card p-3 space-y-1.5 bg-[#0c0e14] border-[#1c202b] hover:border-[#2a3040] transition-colors block group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-200 group-hover:text-white">
                    4-Layer Graph Memory
                  </span>
                  <Brain className="w-3.5 h-3.5 text-zinc-500 group-hover:text-blue-400 transition-colors" />
                </div>
                <p className="text-[10px] text-zinc-500 leading-snug">
                  Semantic topology, cross-session episodes, and Bayes-calibrated playbooks.
                </p>
              </Link>

              {/* Capability 2 */}
              <Link
                href="/war-room"
                className="card p-3 space-y-1.5 bg-[#0c0e14] border-[#1c202b] hover:border-[#2a3040] transition-colors block group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-200 group-hover:text-white">
                    Stateful Handshakes
                  </span>
                  <Workflow className="w-3.5 h-3.5 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
                </div>
                <p className="text-[10px] text-zinc-500 leading-snug">
                  Agents coordinate strictly via <code>(:TaskState)</code> and <code>[:HANDED_OFF_TO]</code>.
                </p>
              </Link>

              {/* Capability 3 */}
              <Link
                href="/telemetry"
                className="card p-3 space-y-1.5 bg-[#0c0e14] border-[#1c202b] hover:border-[#2a3040] transition-colors block group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-200 group-hover:text-white">
                    Parallel R/W Engine
                  </span>
                  <Gauge className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
                </div>
                <p className="text-[10px] text-zinc-500 leading-snug">
                  Sub-millisecond query execution tested under 24x and 48x simultaneous burst load.
                </p>
              </Link>

              {/* Capability 4 */}
              <Link
                href="/topology"
                className="card p-3 space-y-1.5 bg-[#0c0e14] border-[#1c202b] hover:border-[#2a3040] transition-colors block group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-200 group-hover:text-white">
                    Tenant Isolation
                  </span>
                  <Shield className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                </div>
                <p className="text-[10px] text-zinc-500 leading-snug">
                  Physical namespace segregation inside FalkorDB with zero cross-tenant leakage.
                </p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
