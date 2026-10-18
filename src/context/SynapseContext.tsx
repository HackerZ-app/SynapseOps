"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import {
  Tenant,
  QueryTelemetry,
  InspectResponse,
  SwarmResult,
  BenchmarkResult,
  SessionSummary,
  DeduplicatedProcedure,
  PRESETS,
} from "@/types/synapse";
import { GraphNode, GraphEdge } from "@/components/CognitiveGraphCanvas";

interface SynapseContextType {
  tenantId: Tenant;
  activeSessionId: string;
  setSessionId: (id: string) => void;
  inspectData: InspectResponse | null;
  lastSwarmResult: SwarmResult | null;
  setSwarmResult: (res: SwarmResult | null) => void;
  lastBenchmarkResult: BenchmarkResult | null;
  telemetryLog: QueryTelemetry[];
  isSeeding: boolean;
  isInspecting: boolean;
  isInvestigating: boolean;
  isBenchmarking: boolean;
  feedbackLoading: string | null;
  feedbackToast: string | null;
  setFeedbackToast: (toast: string | null) => void;
  selectedHopNodeId: string | null;
  setSelectedHopNodeId: (id: string | null) => void;
  sessionsList: SessionSummary[];
  alertText: string;
  setAlertText: (text: string) => void;
  seedStatus: { type: "success" | "error"; message: string } | null;
  setSeedStatus: (status: { type: "success" | "error"; message: string } | null) => void;
  deduplicatedProcedures: DeduplicatedProcedure[];
  canvasNodes: GraphNode[];
  canvasEdges: GraphEdge[];
  highlightedNodeIds: string[];
  switchTenant: (newTenant: Tenant) => Promise<void>;
  seedTenant: (reset?: boolean) => Promise<void>;
  dispatchSwarm: (overrideAlert?: string) => Promise<SwarmResult | null>;
  submitFeedback: (
    procedureId: string,
    serviceId: string,
    outcome: "SUCCESS" | "FAILURE"
  ) => Promise<void>;
  runBenchmark: (concurrencyLevel?: number) => Promise<BenchmarkResult | null>;
  refreshGraph: () => Promise<void>;
  startNewSession: () => void;
  fetchSessions: () => Promise<void>;
}

const SynapseContext = createContext<SynapseContextType | undefined>(undefined);

export function SynapseProvider({ children }: { children: ReactNode }) {
  const [tenantId, setTenantId] = useState<Tenant>("acme-fintech");
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [inspectData, setInspectData] = useState<InspectResponse | null>(null);
  const [lastSwarmResult, setSwarmResult] = useState<SwarmResult | null>(null);
  const [lastBenchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
  const [telemetryLog, setTelemetryLog] = useState<QueryTelemetry[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [selectedHopNodeId, setSelectedHopNodeId] = useState<string | null>(null);
  const [sessionsList, setSessionsList] = useState<SessionSummary[]>([]);
  const [alertText, setAlertText] = useState<string>(PRESETS["acme-fintech"][0].alert);
  const [seedStatus, setSeedStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Initialize unique session on client mount
  useEffect(() => {
    setActiveSessionId(`sess-${Date.now().toString(36)}`);
  }, []);

  // Fetch inspect data from FalkorDB
  const handleInspect = useCallback(async (tenant: Tenant = tenantId) => {
    setIsInspecting(true);
    try {
      const res = await fetch(`/api/graph/inspect?tenantId=${tenant}`);
      const data: InspectResponse = await res.json();
      if (data.error) {
        setSeedStatus({ type: "error", message: data.error });
      } else {
        setInspectData(data);
        if (data.telemetry && data.telemetry.length > 0) {
          setTelemetryLog(data.telemetry);
        }
      }
    } catch (err) {
      setSeedStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Inspect failed",
      });
    } finally {
      setIsInspecting(false);
    }
  }, [tenantId]);

  // Fetch session history from FalkorDB
  const fetchSessions = useCallback(async (tenant: Tenant = tenantId) => {
    try {
      const res = await fetch(`/api/sessions?tenantId=${tenant}`);
      const data = await res.json();
      if (data.sessions && Array.isArray(data.sessions)) {
        setSessionsList(data.sessions);
      }
    } catch {
      // Non-blocking background session query
    }
  }, [tenantId]);

  // Initial load & tenant change
  useEffect(() => {
    handleInspect(tenantId);
    fetchSessions(tenantId);
    setAlertText(PRESETS[tenantId][0].alert);
    setSwarmResult(null);
    setSelectedHopNodeId(null);
  }, [tenantId, handleInspect, fetchSessions]);

  // Deduplicate procedural runbooks by procedureId
  const deduplicatedProcedures = useMemo(() => {
    if (!inspectData?.proceduralWeights) return [];
    const map = new Map<string, DeduplicatedProcedure>();

    for (const pw of inspectData.proceduralWeights) {
      if (!map.has(pw.procedureId)) {
        map.set(pw.procedureId, {
          procedureId: pw.procedureId,
          procedureName: pw.procedureName,
          primaryServiceId: pw.serviceId,
          targetServices: [{ serviceId: pw.serviceId, serviceName: pw.serviceName }],
          successCount: pw.successCount,
          failCount: pw.failCount,
          confidenceWeight: pw.confidenceWeight,
          lastUsed: pw.lastUsed,
        });
      } else {
        const item = map.get(pw.procedureId)!;
        if (!item.targetServices.some((s) => s.serviceId === pw.serviceId)) {
          item.targetServices.push({ serviceId: pw.serviceId, serviceName: pw.serviceName });
        }
        if (pw.confidenceWeight > item.confidenceWeight) {
          item.confidenceWeight = pw.confidenceWeight;
          item.successCount = pw.successCount;
          item.failCount = pw.failCount;
        }
      }
    }
    return Array.from(map.values());
  }, [inspectData?.proceduralWeights]);

  // Canvas nodes and edges
  const canvasNodes: GraphNode[] = useMemo(
    () => (inspectData?.topology?.nodes || []) as GraphNode[],
    [inspectData?.topology?.nodes]
  );

  const canvasEdges: GraphEdge[] = useMemo(
    () => (inspectData?.topology?.edges || []) as GraphEdge[],
    [inspectData?.topology?.edges]
  );

  // Active Reasoning Subgraph Highlighting
  const highlightedNodeIds = useMemo(() => {
    const ids: string[] = [];
    if (lastSwarmResult) {
      ids.push(...lastSwarmResult.reasoningSubgraph.nodes.map((n) => n.id));
      if (lastSwarmResult.matchedService) ids.push(lastSwarmResult.matchedService.id);
      if (lastSwarmResult.rootCauseService) ids.push(lastSwarmResult.rootCauseService.id);
      if (lastSwarmResult.selectedProcedure) {
        ids.push(lastSwarmResult.selectedProcedure.procedureId);
      }
    }
    if (selectedHopNodeId) {
      ids.push(selectedHopNodeId);
    }
    return Array.from(new Set(ids));
  }, [lastSwarmResult, selectedHopNodeId]);

  // Switch tenant
  const switchTenant = useCallback(async (newTenant: Tenant) => {
    setTenantId(newTenant);
  }, []);

  // Seed tenant graph
  const seedTenant = useCallback(
    async (reset: boolean = true) => {
      setIsSeeding(true);
      setSeedStatus(null);
      try {
        const res = await fetch("/api/graph/seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, reset }),
        });
        const data = await res.json();
        if (data.success) {
          setSeedStatus({
            type: "success",
            message: `Tenant [${tenantId}] successfully seeded in FalkorDB with ${data.createdNodes} nodes and ${data.createdEdges} edges.`,
          });
          if (data.telemetry) setTelemetryLog(data.telemetry);
          await handleInspect(tenantId);
          await fetchSessions(tenantId);
        } else {
          setSeedStatus({ type: "error", message: data.error || "Seed failed" });
        }
      } catch (err) {
        setSeedStatus({
          type: "error",
          message: err instanceof Error ? err.message : "Seed failed",
        });
      } finally {
        setIsSeeding(false);
      }
    },
    [tenantId, handleInspect, fetchSessions]
  );

  // Dispatch multi-agent incident swarm
  const dispatchSwarm = useCallback(
    async (overrideAlert?: string): Promise<SwarmResult | null> => {
      const textToUse = overrideAlert || alertText;
      if (!textToUse.trim()) return null;

      setIsInvestigating(true);
      setSelectedHopNodeId(null);
      try {
        const res = await fetch("/api/agents/investigate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId,
            sessionId: activeSessionId || `sess-${Date.now().toString(36)}`,
            alertText: textToUse.trim(),
            userEngineer: "SRE-OnCall",
          }),
        });

        const data = await res.json();
        if (data.error) {
          setSeedStatus({ type: "error", message: data.error });
          return null;
        }

        setSwarmResult(data as SwarmResult);
        if (data.allTelemetry) setTelemetryLog(data.allTelemetry);
        await handleInspect(tenantId);
        await fetchSessions(tenantId);
        return data as SwarmResult;
      } catch (err) {
        setSeedStatus({
          type: "error",
          message: err instanceof Error ? err.message : "Incident swarm failed",
        });
        return null;
      } finally {
        setIsInvestigating(false);
      }
    },
    [alertText, tenantId, activeSessionId, handleInspect, fetchSessions]
  );

  // Submit human/autonomous procedural feedback
  const submitFeedback = useCallback(
    async (
      procedureId: string,
      serviceId: string,
      outcome: "SUCCESS" | "FAILURE"
    ) => {
      setFeedbackLoading(`${procedureId}-${outcome}`);
      try {
        const res = await fetch("/api/agents/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId,
            sessionId: activeSessionId || `sess-${Date.now().toString(36)}`,
            procedureId,
            targetServiceId: serviceId,
            outcome,
            notes: `Feedback outcome [${outcome}] recorded from SynapseOps UI console.`,
            symptom: alertText.slice(0, 100),
            rootCause: lastSwarmResult?.rootCauseService?.name || serviceId,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setFeedbackToast(
            `FalkorDB procedural confidence for [${procedureId}] updated to ${(
              data.updatedConfidenceWeight * 100
            ).toFixed(0)}% (Successes: ${data.successCount}, Fails: ${
              data.failCount
            }). Recorded episode ${data.createdEpisodeId}.`
          );
          if (data.telemetry) setTelemetryLog(data.telemetry);
          await handleInspect(tenantId);
          await fetchSessions(tenantId);
        } else {
          setSeedStatus({ type: "error", message: data.error || "Feedback failed" });
        }
      } catch (err) {
        setSeedStatus({
          type: "error",
          message: err instanceof Error ? err.message : "Feedback update failed",
        });
      } finally {
        setFeedbackLoading(null);
      }
    },
    [tenantId, activeSessionId, alertText, lastSwarmResult, handleInspect, fetchSessions]
  );

  // Run high-concurrency benchmark
  const runBenchmark = useCallback(
    async (concurrencyLevel: number = 24): Promise<BenchmarkResult | null> => {
      setIsBenchmarking(true);
      try {
        const res = await fetch("/api/graph/benchmark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, concurrencyLevel }),
        });

        const data = await res.json();
        if (data.success) {
          setBenchmarkResult(data as BenchmarkResult);
          if (data.telemetry) setTelemetryLog(data.telemetry);
          return data as BenchmarkResult;
        } else {
          setSeedStatus({
            type: "error",
            message: data.error || "Benchmark execution failed",
          });
          return null;
        }
      } catch (err) {
        setSeedStatus({
          type: "error",
          message: err instanceof Error ? err.message : "Benchmark failed",
        });
        return null;
      } finally {
        setIsBenchmarking(false);
      }
    },
    [tenantId]
  );

  // Refresh graph data
  const refreshGraph = useCallback(async () => {
    await handleInspect(tenantId);
    await fetchSessions(tenantId);
  }, [tenantId, handleInspect, fetchSessions]);

  // Start fresh session
  const startNewSession = useCallback(() => {
    const newId = `sess-${Date.now().toString(36)}`;
    setActiveSessionId(newId);
    setSwarmResult(null);
    setFeedbackToast(null);
    setSelectedHopNodeId(null);
  }, []);

  return (
    <SynapseContext.Provider
      value={{
        tenantId,
        activeSessionId,
        setSessionId: setActiveSessionId,
        inspectData,
        lastSwarmResult,
        setSwarmResult,
        lastBenchmarkResult,
        telemetryLog,
        isSeeding,
        isInspecting,
        isInvestigating,
        isBenchmarking,
        feedbackLoading,
        feedbackToast,
        setFeedbackToast,
        selectedHopNodeId,
        setSelectedHopNodeId,
        sessionsList,
        alertText,
        setAlertText,
        seedStatus,
        setSeedStatus,
        deduplicatedProcedures,
        canvasNodes,
        canvasEdges,
        highlightedNodeIds,
        switchTenant,
        seedTenant,
        dispatchSwarm,
        submitFeedback,
        runBenchmark,
        refreshGraph,
        startNewSession,
        fetchSessions,
      }}
    >
      {children}
    </SynapseContext.Provider>
  );
}

export function useSynapse() {
  const context = useContext(SynapseContext);
  if (!context) {
    throw new Error("useSynapse must be used within a SynapseProvider");
  }
  return context;
}
