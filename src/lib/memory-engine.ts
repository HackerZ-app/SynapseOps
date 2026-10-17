/**
 * SynapseOps — Cognitive Memory & Graph Traversal Engine
 *
 * Implements the core graph operations against FalkorDB across all 4 cognitive layers:
 *   1. Semantic Memory: Topology traversal & multi-hop blast radius discovery
 *   2. Episodic Memory: Cross-session historical incident recall
 *   3. Procedural Memory: Runbook ranking & dynamic confidence mutation
 *   4. Agent Coordination: Graph-mediated task handoffs via (:TaskState)
 *
 * HACKATHON RULE 3: Agents do NOT communicate through in-memory JavaScript state.
 * All handoffs and context transitions are persisted in FalkorDB via OpenCypher.
 */

import { executeReadQuery, executeWriteQuery, QueryResult } from './falkordb';
import type { Service, Team, Episode, Step } from './schema';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface BlastRadiusResult {
  service: Service | null;
  downstream: Array<{
    id: string;
    name: string;
    tier: string;
    ownerTeam: string;
    status: string;
    depth: number;
  }>;
  upstreamCallers: Array<{
    id: string;
    name: string;
    tier: string;
    ownerTeam: string;
    status: string;
    depth: number;
  }>;
  owningTeam: Team | null;
  shortestPathToDeepest: {
    targetService: string;
    targetServiceName: string;
    hops: number;
    nodeIds: string[];
    nodeNames: string[];
  } | null;
}

export interface EpisodicRecallItem {
  id: string;
  sessionId: string;
  symptom: string;
  rootCause: string;
  summary: string;
  resolved: boolean;
  timestamp: string;
  affectedService: string;
  affectedServiceId: string;
}

export interface ProceduralRunbookItem {
  procedureId: string;
  name: string;
  symptomPattern: string;
  targetServiceId: string;
  targetServiceName: string;
  successCount: number;
  failCount: number;
  confidenceWeight: number;
  lastUsed: string;
  steps: Step[];
}

export interface TaskStateHandoff {
  taskId: string;
  status: string;
  stage: string;
  hypothesis: string;
  blastRadiusJson: string;
  selectedProcedureId: string;
  rootCauseServiceId: string;
  updatedAt: string;
  reason: string;
  contextSummary: string;
  handoffTimestamp: string;
  fromAgentId: string;
  fromAgentName: string;
  serviceId: string;
  serviceName: string;
}

// ─── 1. Session & Conversation Turn Persistence ────────────────────────────

export async function recordConversationTurn(
  tenantId: string,
  params: {
    sessionId: string;
    sessionTitle?: string;
    userEngineer?: string;
    turnId: string;
    role: 'user' | 'agent-triage' | 'agent-investigator' | 'agent-commander' | 'system';
    content: string;
    agentId?: string;
    timestamp?: string;
  }
): Promise<QueryResult> {
  const ts = params.timestamp || new Date().toISOString();
  const sessionTitle = params.sessionTitle || `Incident Session ${params.sessionId}`;
  const userEngineer = params.userEngineer || 'sre-oncall@synapse.io';
  const agentId = params.agentId || (params.role.startsWith('agent-') ? params.role : '');

  // Step 1: Upsert Session & Create Turn
  const query = `
    MERGE (sess:Session {id: $sessionId})
    ON CREATE SET sess.title = $sessionTitle,
                  sess.started_at = $timestamp,
                  sess.user_engineer = $userEngineer
    CREATE (turn:Turn {
      id: $turnId,
      role: $role,
      content: $content,
      agent_id: $agentId,
      timestamp: $timestamp
    })
    CREATE (sess)-[:HAS_TURN]->(turn)
    RETURN turn.id AS turnId
  `;

  const res = await executeWriteQuery(tenantId, 'memory:record-turn', query, {
    sessionId: params.sessionId,
    sessionTitle,
    userEngineer,
    turnId: params.turnId,
    role: params.role,
    content: params.content,
    agentId,
    timestamp: ts,
  });

  // Step 2: Chain sequential turn via NEXT_TURN
  try {
    const chainQuery = `
      MATCH (sess:Session {id: $sessionId})-[:HAS_TURN]->(prev:Turn)
      WHERE prev.id <> $turnId AND NOT (prev)-[:NEXT_TURN]->()
      MATCH (turn:Turn {id: $turnId})
      MERGE (prev)-[:NEXT_TURN]->(turn)
      RETURN prev.id AS prevTurnId, turn.id AS nextTurnId
    `;
    await executeWriteQuery(tenantId, 'memory:chain-turn', chainQuery, {
      sessionId: params.sessionId,
      turnId: params.turnId,
    });
  } catch {
    // Non-fatal if first turn
  }

  return res;
}

// ─── 2. Multi-Hop Blast Radius & Dependency Discovery ──────────────────────

export async function queryServiceBlastRadius(
  tenantId: string,
  serviceIdentifier: string
): Promise<BlastRadiusResult> {
  // Find matching service
  const matchServiceQuery = `
    MATCH (s:Service)
    WHERE s.id = $ident OR toLower(s.name) = toLower($ident) OR toLower(s.name) CONTAINS toLower($ident)
    RETURN s.id AS id, s.name AS name, s.tier AS tier, s.owner_team AS owner_team,
           s.language AS language, s.status AS status
    LIMIT 1
  `;
  const svcRes = await executeReadQuery(tenantId, 'blast-radius:match-service', matchServiceQuery, {
    ident: serviceIdentifier,
  });

  const rawSvc = svcRes.data[0];
  if (!rawSvc) {
    return {
      service: null,
      downstream: [],
      upstreamCallers: [],
      owningTeam: null,
      shortestPathToDeepest: null,
    };
  }

  const service: Service = {
    id: String(rawSvc.id),
    name: String(rawSvc.name),
    tier: rawSvc.tier,
    owner_team: String(rawSvc.owner_team),
    language: String(rawSvc.language),
    status: rawSvc.status,
  };

  // Run parallel queries: downstream dependencies, upstream callers, owning team, and shortest path
  const [downstreamRes, upstreamRes, teamRes, shortestPathRes] = await Promise.all([
    // Downstream dependencies (up to 3 hops)
    executeReadQuery(
      tenantId,
      'blast-radius:downstream',
      `MATCH (s:Service {id: $sId})-[r:DEPENDS_ON*1..3]->(dep:Service)
       RETURN DISTINCT dep.id AS id, dep.name AS name, dep.tier AS tier,
              dep.owner_team AS ownerTeam, dep.status AS status, length(r) AS depth
       ORDER BY depth ASC`,
      { sId: service.id }
    ),

    // Upstream callers impacted (blast radius)
    executeReadQuery(
      tenantId,
      'blast-radius:upstream',
      `MATCH (caller:Service)-[r:DEPENDS_ON*1..3]->(s:Service {id: $sId})
       RETURN DISTINCT caller.id AS id, caller.name AS name, caller.tier AS tier,
              caller.owner_team AS ownerTeam, caller.status AS status, length(r) AS depth
       ORDER BY depth ASC`,
      { sId: service.id }
    ),

    // Owning team
    executeReadQuery(
      tenantId,
      'blast-radius:owning-team',
      `MATCH (t:Team)-[:OWNS]->(s:Service {id: $sId})
       RETURN t.id AS id, t.name AS name, t.oncall_channel AS oncall_channel
       LIMIT 1`,
      { sId: service.id }
    ),

    // Deepest critical dependency and shortest path
    executeReadQuery(
      tenantId,
      'blast-radius:shortest-path',
      `MATCH (s:Service {id: $sId}), (d:Service)
       WHERE d.id <> s.id
       WITH s, d, shortestPath((s)-[:DEPENDS_ON*]->(d)) AS p
       WHERE p IS NOT NULL
       RETURN d.id AS targetService, d.name AS targetServiceName,
              [n in nodes(p) | n.id] AS nodeIds, [n in nodes(p) | n.name] AS nodeNames,
              length(p) AS hops
       ORDER BY hops DESC
       LIMIT 1`,
      { sId: service.id }
    ),
  ]);

  const downstream = downstreamRes.data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name),
    tier: String(row.tier),
    ownerTeam: String(row.ownerTeam),
    status: String(row.status),
    depth: Number(row.depth) || 1,
  }));

  const upstreamCallers = upstreamRes.data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name),
    tier: String(row.tier),
    ownerTeam: String(row.ownerTeam),
    status: String(row.status),
    depth: Number(row.depth) || 1,
  }));

  const rawTeam = teamRes.data[0];
  const owningTeam: Team | null = rawTeam
    ? {
        id: String(rawTeam.id),
        name: String(rawTeam.name),
        oncall_channel: String(rawTeam.oncall_channel),
      }
    : null;

  const rawSp = shortestPathRes.data[0];
  const shortestPathToDeepest = rawSp
    ? {
        targetService: String(rawSp.targetService),
        targetServiceName: String(rawSp.targetServiceName),
        hops: Number(rawSp.hops) || 0,
        nodeIds: Array.isArray(rawSp.nodeIds) ? rawSp.nodeIds.map(String) : [],
        nodeNames: Array.isArray(rawSp.nodeNames) ? rawSp.nodeNames.map(String) : [],
      }
    : null;

  return {
    service,
    downstream,
    upstreamCallers,
    owningTeam,
    shortestPathToDeepest,
  };
}

// ─── 3. Cross-Session Episodic Memory Recall ───────────────────────────────

export async function recallEpisodicMemory(
  tenantId: string,
  serviceId: string
): Promise<EpisodicRecallItem[]> {
  const query = `
    MATCH (s:Service {id: $serviceId})
    OPTIONAL MATCH (s)-[:DEPENDS_ON*1..2]->(dep:Service)
    WITH s, collect(dep) AS deps
    WITH [s] + deps AS allServices
    UNWIND allServices AS target
    MATCH (ep:Episode)-[:AFFECTED]->(target)
    RETURN DISTINCT ep.id AS id, ep.session_id AS sessionId, ep.symptom AS symptom,
           ep.root_cause AS rootCause, ep.summary AS summary, ep.resolved AS resolved,
           ep.timestamp AS timestamp, target.name AS affectedService, target.id AS affectedServiceId
    ORDER BY ep.timestamp DESC
  `;

  const res = await executeReadQuery(tenantId, 'episodic:cross-session-recall', query, { serviceId });

  return res.data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    sessionId: String(row.sessionId),
    symptom: String(row.symptom),
    rootCause: String(row.rootCause),
    summary: String(row.summary),
    resolved: Boolean(row.resolved),
    timestamp: String(row.timestamp),
    affectedService: String(row.affectedService),
    affectedServiceId: String(row.affectedServiceId),
  }));
}

// ─── 4. Procedural Memory Retrieval & Confidence Ranking ───────────────────

export async function queryProceduralRunbooks(
  tenantId: string,
  serviceId: string
): Promise<ProceduralRunbookItem[]> {
  // Query all procedures applying to the service or its downstream targets
  const procQuery = `
    MATCH (s:Service {id: $serviceId})
    OPTIONAL MATCH (s)-[:DEPENDS_ON*1..2]->(dep:Service)
    WITH s, collect(dep) AS deps
    WITH [s] + deps AS allServices
    UNWIND allServices AS target
    MATCH (p:Procedure)-[r:LED_TO_RESOLUTION]->(target)
    RETURN DISTINCT p.id AS procedureId, p.name AS name, p.symptom_pattern AS symptomPattern,
           target.id AS targetServiceId, target.name AS targetServiceName,
           r.success_count AS successCount, r.fail_count AS failCount,
           r.confidence_weight AS confidenceWeight, r.last_used AS lastUsed
    ORDER BY r.confidence_weight DESC
  `;

  const procRes = await executeReadQuery(tenantId, 'procedural:query-runbooks', procQuery, { serviceId });

  // For each procedure, query its ordered execution steps
  const procedures: ProceduralRunbookItem[] = [];

  for (const row of procRes.data) {
    const procedureId = String(row.procedureId);

    const stepsQuery = `
      MATCH (p:Procedure {id: $procedureId})-[:START_STEP]->(first:Step)
      OPTIONAL MATCH (first)-[:NEXT_STEP*0..5]->(st:Step)
      RETURN DISTINCT st.id AS id, st.order_num AS orderNum, st.action AS action,
             st.command AS command, st.tool_name AS toolName
      ORDER BY st.order_num ASC
    `;

    const stepsRes = await executeReadQuery(tenantId, `procedural:steps-${procedureId}`, stepsQuery, {
      procedureId,
    });

    const steps: Step[] = stepsRes.data.map((st: Record<string, unknown>) => ({
      id: String(st.id),
      order: Number(st.orderNum) || 1,
      action: String(st.action),
      command: String(st.command),
      tool_name: String(st.toolName),
    }));

    procedures.push({
      procedureId,
      name: String(row.name),
      symptomPattern: String(row.symptomPattern),
      targetServiceId: String(row.targetServiceId),
      targetServiceName: String(row.targetServiceName),
      successCount: Number(row.successCount) || 0,
      failCount: Number(row.failCount) || 0,
      confidenceWeight: Number(row.confidenceWeight) || 0,
      lastUsed: String(row.lastUsed || ''),
      steps,
    });
  }

  return procedures;
}

// ─── 5. Graph-Mediated Agent Handoffs ──────────────────────────────────────

export async function writeAgentHandoff(
  tenantId: string,
  params: {
    taskId: string;
    sessionId: string;
    status: 'investigating' | 'executing' | 'resolved' | 'escalated';
    stage: 'TRIAGE_COMPLETE' | 'INVESTIGATION_COMPLETE' | 'AWAITING_REMEDIATION_FEEDBACK';
    hypothesis: string;
    blastRadiusJson: string;
    selectedProcedureId?: string;
    rootCauseServiceId?: string;
    serviceId: string;
    fromAgentId: string;
    toAgentId: string;
    reason: string;
    contextSummary: string;
  }
): Promise<QueryResult> {
  const ts = new Date().toISOString();

  const cypher = `
    MERGE (ts:TaskState {id: $taskId})
    SET ts.session_id = $sessionId,
        ts.status = $status,
        ts.stage = $stage,
        ts.hypothesis = $hypothesis,
        ts.blast_radius_json = $blastRadiusJson,
        ts.selected_procedure_id = $selectedProcedureId,
        ts.root_cause_service_id = $rootCauseServiceId,
        ts.updated_at = $timestamp
    WITH ts
    MATCH (src:Agent {id: $fromAgentId})
    MERGE (src)-[:CREATED_STATE]->(ts)
    WITH ts
    MATCH (dst:Agent {id: $toAgentId})
    CREATE (ts)-[h:HANDED_OFF_TO {
      reason: $reason,
      context_summary: $contextSummary,
      stage: $stage,
      timestamp: $timestamp
    }]->(dst)
    WITH ts
    MATCH (svc:Service {id: $serviceId})
    MERGE (ts)-[:INVESTIGATING]->(svc)
    RETURN ts.id AS taskId
  `;

  return executeWriteQuery(tenantId, 'coordination:write-handoff', cypher, {
    taskId: params.taskId,
    sessionId: params.sessionId,
    status: params.status,
    stage: params.stage,
    hypothesis: params.hypothesis,
    blastRadiusJson: params.blastRadiusJson,
    selectedProcedureId: params.selectedProcedureId || '',
    rootCauseServiceId: params.rootCauseServiceId || '',
    serviceId: params.serviceId,
    fromAgentId: params.fromAgentId,
    toAgentId: params.toAgentId,
    reason: params.reason,
    contextSummary: params.contextSummary,
    timestamp: ts,
  });
}

export async function readIncomingHandoff(
  tenantId: string,
  sessionId: string,
  receivingAgentId: string
): Promise<TaskStateHandoff | null> {
  const cypher = `
    MATCH (ts:TaskState {session_id: $sessionId})-[h:HANDED_OFF_TO]->(a:Agent {id: $receivingAgentId})
    OPTIONAL MATCH (src:Agent)-[:CREATED_STATE]->(ts)
    OPTIONAL MATCH (ts)-[:INVESTIGATING]->(s:Service)
    RETURN ts.id AS taskId, ts.status AS status, ts.stage AS stage,
           ts.hypothesis AS hypothesis, ts.blast_radius_json AS blastRadiusJson,
           ts.selected_procedure_id AS selectedProcedureId,
           ts.root_cause_service_id AS rootCauseServiceId,
           ts.updated_at AS updatedAt,
           h.reason AS reason, h.context_summary AS contextSummary, h.timestamp AS handoffTimestamp,
           src.id AS fromAgentId, src.name AS fromAgentName,
           s.id AS serviceId, s.name AS serviceName
    ORDER BY h.timestamp DESC
    LIMIT 1
  `;

  const res = await executeReadQuery(tenantId, 'coordination:read-incoming-handoff', cypher, {
    sessionId,
    receivingAgentId,
  });

  const row = res.data[0];
  if (!row) return null;

  return {
    taskId: String(row.taskId),
    status: String(row.status),
    stage: String(row.stage),
    hypothesis: String(row.hypothesis || ''),
    blastRadiusJson: String(row.blastRadiusJson || '[]'),
    selectedProcedureId: String(row.selectedProcedureId || ''),
    rootCauseServiceId: String(row.rootCauseServiceId || ''),
    updatedAt: String(row.updatedAt),
    reason: String(row.reason),
    contextSummary: String(row.contextSummary),
    handoffTimestamp: String(row.handoffTimestamp),
    fromAgentId: String(row.fromAgentId || ''),
    fromAgentName: String(row.fromAgentName || ''),
    serviceId: String(row.serviceId || ''),
    serviceName: String(row.serviceName || ''),
  };
}

// ─── 6. Self-Learning Procedural Weight Mutation ───────────────────────────

export async function mutateProceduralMemory(
  tenantId: string,
  params: {
    sessionId: string;
    taskId?: string;
    procedureId: string;
    targetServiceId: string;
    outcome: 'SUCCESS' | 'FAILURE';
    symptom?: string;
    rootCause?: string;
    notes?: string;
  }
): Promise<{
  procedureId: string;
  procedureName: string;
  serviceId: string;
  serviceName: string;
  previousWeight?: number;
  newConfidenceWeight: number;
  successCount: number;
  failCount: number;
  createdEpisodeId: string;
}> {
  const ts = new Date().toISOString();
  const episodeId = `ep-${Date.now().toString(36)}`;

  const successDelta = params.outcome === 'SUCCESS' ? 1 : 0;
  const failDelta = params.outcome === 'FAILURE' ? 1 : 0;

  // Step 1: Update all resolution edges for this procedure across linked services
  const mutateCypher = `
    MATCH (p:Procedure {id: $procedureId})-[r:LED_TO_RESOLUTION]->(s:Service)
    SET r.success_count = coalesce(r.success_count, 0) + $successDelta,
        r.fail_count = coalesce(r.fail_count, 0) + $failDelta
    WITH p, r, s,
         toFloat(coalesce(r.success_count, 0)) AS totalSucc,
         toFloat(coalesce(r.success_count, 0) + coalesce(r.fail_count, 0)) AS totalRuns
    SET r.confidence_weight = CASE
          WHEN totalRuns = 0.0 THEN 0.5
          ELSE round((totalSucc / totalRuns) * 100.0) / 100.0
        END,
        r.last_used = $timestamp
    RETURN p.id AS procedureId, p.name AS procedureName, s.id AS serviceId, s.name AS serviceName,
           r.success_count AS successCount, r.fail_count AS failCount,
           r.confidence_weight AS newConfidenceWeight, r.last_used AS lastUsed
  `;

  const mutateRes = await executeWriteQuery(tenantId, 'procedural:mutate-weight', mutateCypher, {
    procedureId: params.procedureId,
    successDelta,
    failDelta,
    timestamp: ts,
  });

  const row = mutateRes.data[0] || {};

  // Step 2: Write new (:Episode) node and link via [:RECORDED_EPISODE] and [:AFFECTED]
  const procName = row.procedureName || params.procedureId;
  const svcName = row.serviceName || params.targetServiceId;
  const newWeight = row.newConfidenceWeight ?? 0;

  const symptom =
    params.symptom ||
    `Incident remediation feedback for ${procName} on ${svcName} (Session ${params.sessionId})`;
  const rootCause =
    params.rootCause ||
    `Procedure ${procName} executed with outcome ${params.outcome}. FalkorDB confidence weight adjusted to ${(newWeight * 100).toFixed(0)}%.`;
  const summary =
    params.notes ||
    `Live War Room Feedback in session ${params.sessionId}: Executed ${procName} with outcome ${params.outcome}. FalkorDB confidence weight updated to ${(newWeight * 100).toFixed(0)}% (${row.successCount} successes, ${row.failCount} failures).`;

  const episodeCypher = `
    CREATE (ep:Episode {
      id: $episodeId,
      session_id: $sessionId,
      symptom: $symptom,
      root_cause: $rootCause,
      summary: $summary,
      resolved: $resolved,
      timestamp: $timestamp
    })
    WITH ep
    MATCH (s:Service {id: $targetServiceId})
    MERGE (ep)-[:AFFECTED]->(s)
    WITH ep
    MATCH (p:Procedure {id: $procedureId})-[:LED_TO_RESOLUTION|APPLIES_TO]->(linkedSvc:Service)
    MERGE (ep)-[:AFFECTED]->(linkedSvc)
    WITH ep
    OPTIONAL MATCH (sess:Session {id: $sessionId})-[:HAS_TURN]->(lastTurn:Turn)
    WHERE NOT (lastTurn)-[:NEXT_TURN]->()
    FOREACH (_ IN CASE WHEN lastTurn IS NOT NULL THEN [1] ELSE [] END |
      MERGE (lastTurn)-[:RECORDED_EPISODE]->(ep)
    )
    RETURN ep.id AS episodeId
  `;

  await executeWriteQuery(tenantId, 'episodic:record-new-episode', episodeCypher, {
    episodeId,
    sessionId: params.sessionId,
    procedureId: params.procedureId,
    symptom,
    rootCause,
    summary,
    resolved: params.outcome === 'SUCCESS',
    targetServiceId: params.targetServiceId,
    timestamp: ts,
  });

  return {
    procedureId: String(row.procedureId || params.procedureId),
    procedureName: String(row.procedureName || params.procedureId),
    serviceId: String(row.serviceId || params.targetServiceId),
    serviceName: String(row.serviceName || params.targetServiceId),
    newConfidenceWeight: Number(row.newConfidenceWeight) || 0,
    successCount: Number(row.successCount) || 0,
    failCount: Number(row.failCount) || 0,
    createdEpisodeId: episodeId,
  };
}

// ─── 7. Session History Query ──────────────────────────────────────────────

export async function queryAllSessions(tenantId: string): Promise<
  Array<{
    id: string;
    title: string;
    startedAt: string;
    userEngineer: string;
    turnCount: number;
    episodeCount: number;
  }>
> {
  const cypher = `
    MATCH (sess:Session)
    OPTIONAL MATCH (sess)-[:HAS_TURN]->(t:Turn)
    OPTIONAL MATCH (sess)-[:HAS_TURN]->()-[:RECORDED_EPISODE]->(ep:Episode)
    RETURN sess.id AS id, sess.title AS title, sess.started_at AS startedAt,
           sess.user_engineer AS userEngineer,
           count(DISTINCT t) AS turnCount, count(DISTINCT ep) AS episodeCount
    ORDER BY sess.started_at DESC
  `;

  const res = await executeReadQuery(tenantId, 'sessions:query-all', cypher);

  return res.data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    title: String(row.title || row.id),
    startedAt: String(row.startedAt || ''),
    userEngineer: String(row.userEngineer || ''),
    turnCount: Number(row.turnCount) || 0,
    episodeCount: Number(row.episodeCount) || 0,
  }));
}

export async function querySessionDetails(
  tenantId: string,
  sessionId: string
): Promise<{
  session: { id: string; title: string; startedAt: string; userEngineer: string } | null;
  turns: Array<{ id: string; role: string; content: string; agentId: string; timestamp: string }>;
  episodes: Episode[];
  taskStates: TaskStateHandoff[];
}> {
  const [sessRes, turnsRes, epRes, tasksRes] = await Promise.all([
    executeReadQuery(
      tenantId,
      'sessions:get-meta',
      `MATCH (sess:Session {id: $sessionId})
       RETURN sess.id AS id, sess.title AS title, sess.started_at AS startedAt, sess.user_engineer AS userEngineer LIMIT 1`,
      { sessionId }
    ),
    executeReadQuery(
      tenantId,
      'sessions:get-turns',
      `MATCH (sess:Session {id: $sessionId})-[:HAS_TURN]->(t:Turn)
       RETURN t.id AS id, t.role AS role, t.content AS content, t.agent_id AS agentId, t.timestamp AS timestamp
       ORDER BY t.timestamp ASC`,
      { sessionId }
    ),
    executeReadQuery(
      tenantId,
      'sessions:get-episodes',
      `MATCH (sess:Session {id: $sessionId})-[:HAS_TURN]->()-[:RECORDED_EPISODE]->(ep:Episode)
       RETURN DISTINCT ep.id AS id, ep.session_id AS session_id, ep.symptom AS symptom,
              ep.root_cause AS root_cause, ep.summary AS summary, ep.resolved AS resolved,
              ep.timestamp AS timestamp
       ORDER BY ep.timestamp ASC`,
      { sessionId }
    ),
    executeReadQuery(
      tenantId,
      'sessions:get-taskstates',
      `MATCH (ts:TaskState {session_id: $sessionId})-[h:HANDED_OFF_TO]->(dst:Agent)
       OPTIONAL MATCH (src:Agent)-[:CREATED_STATE]->(ts)
       OPTIONAL MATCH (ts)-[:INVESTIGATING]->(s:Service)
       RETURN ts.id AS taskId, ts.status AS status, ts.stage AS stage,
              ts.hypothesis AS hypothesis, ts.blast_radius_json AS blastRadiusJson,
              ts.selected_procedure_id AS selectedProcedureId,
              ts.root_cause_service_id AS rootCauseServiceId,
              ts.updated_at AS updatedAt,
              h.reason AS reason, h.context_summary AS contextSummary, h.timestamp AS handoffTimestamp,
              src.id AS fromAgentId, src.name AS fromAgentName,
              s.id AS serviceId, s.name AS serviceName
       ORDER BY h.timestamp ASC`,
      { sessionId }
    ),
  ]);

  const rawSess = sessRes.data[0];
  const session = rawSess
    ? {
        id: String(rawSess.id),
        title: String(rawSess.title),
        startedAt: String(rawSess.startedAt),
        userEngineer: String(rawSess.userEngineer),
      }
    : null;

  const turns = turnsRes.data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    role: String(row.role),
    content: String(row.content),
    agentId: String(row.agentId || ''),
    timestamp: String(row.timestamp),
  }));

  const episodes: Episode[] = epRes.data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    session_id: String(row.session_id),
    symptom: String(row.symptom),
    root_cause: String(row.root_cause),
    summary: String(row.summary),
    resolved: Boolean(row.resolved),
    timestamp: String(row.timestamp),
  }));

  const taskStates: TaskStateHandoff[] = tasksRes.data.map((row: Record<string, unknown>) => ({
    taskId: String(row.taskId),
    status: String(row.status),
    stage: String(row.stage),
    hypothesis: String(row.hypothesis || ''),
    blastRadiusJson: String(row.blastRadiusJson || '[]'),
    selectedProcedureId: String(row.selectedProcedureId || ''),
    rootCauseServiceId: String(row.rootCauseServiceId || ''),
    updatedAt: String(row.updatedAt),
    reason: String(row.reason),
    contextSummary: String(row.contextSummary),
    handoffTimestamp: String(row.handoffTimestamp),
    fromAgentId: String(row.fromAgentId || ''),
    fromAgentName: String(row.fromAgentName || ''),
    serviceId: String(row.serviceId || ''),
    serviceName: String(row.serviceName || ''),
  }));

  return { session, turns, episodes, taskStates };
}
