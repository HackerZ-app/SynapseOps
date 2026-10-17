/**
 * SynapseOps — Enterprise Seed Engine
 *
 * Seeds rich, production-realistic data into tenant-isolated FalkorDB graphs.
 * Supports two tenants:
 *   - acme-fintech  (Payment Gateway ecosystem)
 *   - nebula-cloud   (Cloud-native infrastructure)
 *
 * Each seed includes all 4 cognitive layers:
 *   Semantic (topology), Episodic (past incidents), Procedural (runbooks),
 *   and Agent Coordination (handoff states).
 */

import { executeWriteQuery, getTenantGraph } from './falkordb';
import { initializeSchemaIndexes } from './schema';

// ─── Graph Reset ────────────────────────────────────────────────────────────

async function resetTenantGraph(tenantId: string): Promise<void> {
  const graph = await getTenantGraph(tenantId);
  try {
    await graph.delete();
  } catch {
    // Graph may not exist yet — that's fine
  }
}

// ─── Shared: Core Agents ────────────────────────────────────────────────────

async function seedAgents(tenantId: string): Promise<void> {
  const agents = [
    {
      id: 'agent-triage',
      name: 'Triage & Blast Radius Agent',
      role: 'triage',
      specialty: 'Rapid symptom classification, dependency-graph blast-radius analysis, and initial hypothesis formation',
    },
    {
      id: 'agent-investigator',
      name: 'Root-Cause Investigator Agent',
      role: 'investigator',
      specialty: 'Deep episodic memory recall, log correlation, metric anomaly detection, and root-cause isolation',
    },
    {
      id: 'agent-commander',
      name: 'Procedural Commander Agent',
      role: 'commander',
      specialty: 'Runbook selection by confidence weight, remediation execution, and procedural learning feedback loops',
    },
  ];

  for (const a of agents) {
    await executeWriteQuery(
      tenantId,
      'seed:create-agent',
      `MERGE (a:Agent {id: $id})
       SET a.name = $name, a.role = $role, a.specialty = $specialty`,
      a
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACME-FINTECH SEED DATA
// ═══════════════════════════════════════════════════════════════════════════

async function seedAcmeFintech(tenantId: string): Promise<void> {
  // ── Teams ──
  await executeWriteQuery(tenantId, 'seed:team-payments', `
    MERGE (t:Team {id: 'team-payments'})
    SET t.name = 'Payments Engineering', t.oncall_channel = '#oncall-payments'
  `);
  await executeWriteQuery(tenantId, 'seed:team-platform', `
    MERGE (t:Team {id: 'team-platform'})
    SET t.name = 'Platform Infrastructure', t.oncall_channel = '#oncall-platform'
  `);
  await executeWriteQuery(tenantId, 'seed:team-security', `
    MERGE (t:Team {id: 'team-security'})
    SET t.name = 'Security & Identity', t.oncall_channel = '#oncall-security'
  `);

  // ── Services ──
  const services = [
    { id: 'svc-payment-gw', name: 'Payment-Gateway', tier: 'critical', owner_team: 'team-payments', language: 'Go', status: 'healthy' },
    { id: 'svc-auth', name: 'Auth-Service', tier: 'critical', owner_team: 'team-security', language: 'Rust', status: 'healthy' },
    { id: 'svc-ledger-db', name: 'Ledger-DB', tier: 'critical', owner_team: 'team-payments', language: 'PostgreSQL', status: 'healthy' },
    { id: 'svc-fraud-engine', name: 'Fraud-Engine', tier: 'standard', owner_team: 'team-payments', language: 'Python', status: 'healthy' },
    { id: 'svc-redis-cache', name: 'Redis-Cache', tier: 'standard', owner_team: 'team-platform', language: 'Redis', status: 'healthy' },
    { id: 'svc-webhook-worker', name: 'Webhook-Worker', tier: 'auxiliary', owner_team: 'team-payments', language: 'Node.js', status: 'healthy' },
  ];

  for (const svc of services) {
    await executeWriteQuery(tenantId, `seed:service-${svc.id}`, `
      MERGE (s:Service {id: $id})
      SET s.name = $name, s.tier = $tier, s.owner_team = $owner_team,
          s.language = $language, s.status = $status
    `, svc);
  }

  // ── Team Ownership Edges ──
  await executeWriteQuery(tenantId, 'seed:owns-payments', `
    MATCH (t:Team {id: 'team-payments'}), (s:Service)
    WHERE s.owner_team = 'team-payments'
    MERGE (t)-[:OWNS]->(s)
  `);
  await executeWriteQuery(tenantId, 'seed:owns-platform', `
    MATCH (t:Team {id: 'team-platform'}), (s:Service)
    WHERE s.owner_team = 'team-platform'
    MERGE (t)-[:OWNS]->(s)
  `);
  await executeWriteQuery(tenantId, 'seed:owns-security', `
    MATCH (t:Team {id: 'team-security'}), (s:Service)
    WHERE s.owner_team = 'team-security'
    MERGE (t)-[:OWNS]->(s)
  `);

  // ── Service Dependencies ──
  const deps = [
    { from: 'svc-payment-gw', to: 'svc-auth', criticality: 'hard', protocol: 'gRPC' },
    { from: 'svc-payment-gw', to: 'svc-ledger-db', criticality: 'hard', protocol: 'PostgreSQL wire' },
    { from: 'svc-payment-gw', to: 'svc-fraud-engine', criticality: 'soft', protocol: 'HTTP/2' },
    { from: 'svc-auth', to: 'svc-redis-cache', criticality: 'hard', protocol: 'Redis RESP' },
    { from: 'svc-payment-gw', to: 'svc-webhook-worker', criticality: 'soft', protocol: 'AMQP' },
    { from: 'svc-fraud-engine', to: 'svc-ledger-db', criticality: 'soft', protocol: 'PostgreSQL wire' },
  ];

  for (const d of deps) {
    await executeWriteQuery(tenantId, `seed:dep-${d.from}->${d.to}`, `
      MATCH (a:Service {id: $from}), (b:Service {id: $to})
      MERGE (a)-[r:DEPENDS_ON]->(b)
      SET r.criticality = $criticality, r.protocol = $protocol
    `, d);
  }

  // ── Episodic Memory: Past Incidents ──

  // Session 1
  await executeWriteQuery(tenantId, 'seed:session-01', `
    MERGE (s:Session {id: 'sess-01'})
    SET s.title = 'Flash Sale 504 Timeout Investigation',
        s.started_at = '2026-10-10T09:15:00Z',
        s.user_engineer = 'priya.sharma@acme.com'
  `);

  const session1Turns = [
    { id: 'turn-01-01', role: 'user', content: 'We are seeing a massive spike of 504 Gateway Timeouts on Payment-Gateway during the flash sale. p99 latency jumped from 120ms to 14s.', timestamp: '2026-10-10T09:15:30Z' },
    { id: 'turn-01-02', role: 'agent-triage', content: 'Acknowledged. Running blast-radius analysis on Payment-Gateway. Hard dependencies: Auth-Service, Ledger-DB. Soft dependencies: Fraud-Engine, Webhook-Worker. Initial hypothesis: upstream saturation or database connection pool exhaustion.', timestamp: '2026-10-10T09:15:45Z' },
    { id: 'turn-01-03', role: 'agent-investigator', content: 'Querying episodic memory… No prior 504 pattern found for Payment-Gateway. Checking Ledger-DB connection pool metrics. PgBouncer active connections: 498/500 — CRITICAL. Stale advisory locks detected: 47 locks held > 30 minutes. Root cause: connection pool exhaustion in Ledger-DB triggered by a stale lock from the batch reconciliation job.', timestamp: '2026-10-10T09:16:10Z' },
    { id: 'turn-01-04', role: 'agent-commander', content: 'Selecting procedure proc-drain-ledger-pool (confidence: 0.86). Executing: 1) Kill stale advisory locks, 2) Drain PgBouncer, 3) Rebalance read replicas. Result: p99 latency returned to 130ms within 4 minutes. Incident resolved. Updating confidence weight.', timestamp: '2026-10-10T09:18:00Z' },
  ];

  for (let i = 0; i < session1Turns.length; i++) {
    const t = session1Turns[i];
    await executeWriteQuery(tenantId, `seed:turn-${t.id}`, `
      MERGE (turn:Turn {id: $id})
      SET turn.role = $role, turn.content = $content, turn.timestamp = $timestamp
    `, t);

    // Link turn to session
    await executeWriteQuery(tenantId, `seed:session-turn-${t.id}`, `
      MATCH (s:Session {id: 'sess-01'}), (turn:Turn {id: $id})
      MERGE (s)-[:HAS_TURN]->(turn)
    `, { id: t.id });

    // Link to previous turn
    if (i > 0) {
      await executeWriteQuery(tenantId, `seed:turn-chain-${t.id}`, `
        MATCH (prev:Turn {id: $prevId}), (curr:Turn {id: $currId})
        MERGE (prev)-[:NEXT_TURN]->(curr)
      `, { prevId: session1Turns[i - 1].id, currId: t.id });
    }
  }

  // Episode 1
  await executeWriteQuery(tenantId, 'seed:episode-101', `
    MERGE (ep:Episode {id: 'ep-101'})
    SET ep.session_id = 'sess-01',
        ep.symptom = 'Payment-Gateway 504 Gateway Timeout spike during flash sale — p99 latency 14s',
        ep.root_cause = 'Connection pool exhaustion in Ledger-DB triggered by 47 stale advisory locks from batch reconciliation job',
        ep.summary = 'Payment-Gateway 504 Gateway Timeout spike during flash sale. Initial suspect was Payment-Gateway CPU, but root cause was connection pool exhaustion in Ledger-DB triggered by a stale lock.',
        ep.resolved = true,
        ep.timestamp = '2026-10-10T09:18:30Z'
  `);

  await executeWriteQuery(tenantId, 'seed:episode-101-affected-gw', `
    MATCH (ep:Episode {id: 'ep-101'}), (s:Service {id: 'svc-payment-gw'})
    MERGE (ep)-[:AFFECTED]->(s)
  `);
  await executeWriteQuery(tenantId, 'seed:episode-101-affected-ledger', `
    MATCH (ep:Episode {id: 'ep-101'}), (s:Service {id: 'svc-ledger-db'})
    MERGE (ep)-[:AFFECTED]->(s)
  `);
  await executeWriteQuery(tenantId, 'seed:episode-101-recorded', `
    MATCH (ep:Episode {id: 'ep-101'}), (turn:Turn {id: 'turn-01-04'})
    MERGE (turn)-[:RECORDED_EPISODE]->(ep)
  `);

  // Session 2
  await executeWriteQuery(tenantId, 'seed:session-02', `
    MERGE (s:Session {id: 'sess-02'})
    SET s.title = 'Intermittent 401 Auth Failures',
        s.started_at = '2026-10-12T14:30:00Z',
        s.user_engineer = 'carlos.rodriguez@acme.com'
  `);

  const session2Turns = [
    { id: 'turn-02-01', role: 'user', content: 'Getting sporadic 401 Unauthorized errors on Payment-Gateway for about 5% of requests. Users are being logged out randomly.', timestamp: '2026-10-12T14:30:15Z' },
    { id: 'turn-02-02', role: 'agent-triage', content: 'Running blast-radius analysis. Payment-Gateway depends on Auth-Service (hard, gRPC). Auth-Service depends on Redis-Cache (hard, Redis RESP). Hypothesis: session token storage issue in Redis-Cache.', timestamp: '2026-10-12T14:30:30Z' },
    { id: 'turn-02-03', role: 'agent-investigator', content: 'Checking Redis-Cache configuration. Eviction policy is set to "noeviction" with maxmemory at 95% utilization. When Redis hits maxmemory with noeviction, new SET commands fail silently for session tokens. Auth-Service fails to write new session tokens, causing 401s for newly authenticated users.', timestamp: '2026-10-12T14:31:00Z' },
    { id: 'turn-02-04', role: 'agent-commander', content: 'No existing procedure matches this exact pattern. Creating new procedure: 1) Flush expired keys via SCAN + TTL check, 2) Switch eviction policy to allkeys-lru, 3) Increase maxmemory to 8GB. Result: 401 rate dropped to 0% within 2 minutes. Recording new episode.', timestamp: '2026-10-12T14:33:00Z' },
  ];

  for (let i = 0; i < session2Turns.length; i++) {
    const t = session2Turns[i];
    await executeWriteQuery(tenantId, `seed:turn-${t.id}`, `
      MERGE (turn:Turn {id: $id})
      SET turn.role = $role, turn.content = $content, turn.timestamp = $timestamp
    `, t);
    await executeWriteQuery(tenantId, `seed:session-turn-${t.id}`, `
      MATCH (s:Session {id: 'sess-02'}), (turn:Turn {id: $id})
      MERGE (s)-[:HAS_TURN]->(turn)
    `, { id: t.id });
    if (i > 0) {
      await executeWriteQuery(tenantId, `seed:turn-chain-${t.id}`, `
        MATCH (prev:Turn {id: $prevId}), (curr:Turn {id: $currId})
        MERGE (prev)-[:NEXT_TURN]->(curr)
      `, { prevId: session2Turns[i - 1].id, currId: t.id });
    }
  }

  // Episode 2
  await executeWriteQuery(tenantId, 'seed:episode-102', `
    MERGE (ep:Episode {id: 'ep-102'})
    SET ep.session_id = 'sess-02',
        ep.symptom = 'Intermittent 401 Unauthorized errors on Payment-Gateway — 5% of requests affected',
        ep.root_cause = 'Redis-Cache eviction policy (noeviction) dropping Auth-Service session tokens at 95% memory utilization',
        ep.summary = 'Intermittent 401 errors on Payment-Gateway caused by Redis-Cache eviction policy (noeviction) dropping Auth-Service session tokens.',
        ep.resolved = true,
        ep.timestamp = '2026-10-12T14:33:30Z'
  `);

  await executeWriteQuery(tenantId, 'seed:episode-102-affected-gw', `
    MATCH (ep:Episode {id: 'ep-102'}), (s:Service {id: 'svc-payment-gw'})
    MERGE (ep)-[:AFFECTED]->(s)
  `);
  await executeWriteQuery(tenantId, 'seed:episode-102-affected-redis', `
    MATCH (ep:Episode {id: 'ep-102'}), (s:Service {id: 'svc-redis-cache'})
    MERGE (ep)-[:AFFECTED]->(s)
  `);
  await executeWriteQuery(tenantId, 'seed:episode-102-affected-auth', `
    MATCH (ep:Episode {id: 'ep-102'}), (s:Service {id: 'svc-auth'})
    MERGE (ep)-[:AFFECTED]->(s)
  `);
  await executeWriteQuery(tenantId, 'seed:episode-102-recorded', `
    MATCH (ep:Episode {id: 'ep-102'}), (turn:Turn {id: 'turn-02-04'})
    MERGE (turn)-[:RECORDED_EPISODE]->(ep)
  `);

  // ── Procedural Memory: Competing Runbooks ──

  // Procedure 1: Blind restart (low confidence)
  await executeWriteQuery(tenantId, 'seed:proc-restart-gw', `
    MERGE (p:Procedure {id: 'proc-restart-gw'})
    SET p.name = 'Blind Horizontal Restart of Payment-Gateway Pods',
        p.symptom_pattern = 'Payment-Gateway latency spike OR 5xx errors',
        p.target_service_id = 'svc-payment-gw'
  `);

  const restartSteps = [
    { id: 'step-r1', order: 1, action: 'Scale down Payment-Gateway deployment to 0 replicas', command: 'kubectl scale deploy payment-gw --replicas=0', tool_name: 'kubectl' },
    { id: 'step-r2', order: 2, action: 'Wait 30 seconds for graceful drain', command: 'sleep 30', tool_name: 'shell' },
    { id: 'step-r3', order: 3, action: 'Scale up Payment-Gateway deployment to original replica count', command: 'kubectl scale deploy payment-gw --replicas=6', tool_name: 'kubectl' },
    { id: 'step-r4', order: 4, action: 'Verify health check endpoints return 200', command: 'curl -f http://payment-gw:8080/healthz', tool_name: 'curl' },
  ];

  for (const s of restartSteps) {
    await executeWriteQuery(tenantId, `seed:step-${s.id}`, `
      MERGE (st:Step {id: $id})
      SET st.order_num = $order, st.action = $action, st.command = $command, st.tool_name = $tool_name
    `, { ...s, order: s.order });
  }

  await executeWriteQuery(tenantId, 'seed:proc-restart-applies', `
    MATCH (p:Procedure {id: 'proc-restart-gw'}), (s:Service {id: 'svc-payment-gw'})
    MERGE (p)-[:APPLIES_TO]->(s)
  `);
  await executeWriteQuery(tenantId, 'seed:proc-restart-start', `
    MATCH (p:Procedure {id: 'proc-restart-gw'}), (st:Step {id: 'step-r1'})
    MERGE (p)-[:START_STEP]->(st)
  `);

  // Chain steps
  for (let i = 0; i < restartSteps.length - 1; i++) {
    await executeWriteQuery(tenantId, `seed:step-chain-r${i}`, `
      MATCH (a:Step {id: $fromId}), (b:Step {id: $toId})
      MERGE (a)-[:NEXT_STEP]->(b)
    `, { fromId: restartSteps[i].id, toId: restartSteps[i + 1].id });
  }

  // Low confidence resolution edge
  await executeWriteQuery(tenantId, 'seed:proc-restart-resolution', `
    MATCH (p:Procedure {id: 'proc-restart-gw'}), (s:Service {id: 'svc-payment-gw'})
    MERGE (p)-[r:LED_TO_RESOLUTION]->(s)
    SET r.success_count = 1, r.fail_count = 4, r.confidence_weight = 0.20,
        r.last_used = '2026-10-08T11:00:00Z'
  `);

  // Procedure 2: Drain ledger pool (high confidence)
  await executeWriteQuery(tenantId, 'seed:proc-drain-ledger', `
    MERGE (p:Procedure {id: 'proc-drain-ledger-pool'})
    SET p.name = 'Drain Stale PgBouncer Connections & Rebalance Read Replicas on Ledger-DB',
        p.symptom_pattern = 'Ledger-DB connection saturation OR Payment-Gateway timeout with DB dependency',
        p.target_service_id = 'svc-ledger-db'
  `);

  const drainSteps = [
    { id: 'step-d1', order: 1, action: 'Identify and kill stale advisory locks older than 10 minutes', command: 'psql -c "SELECT pg_terminate_backend(pid) FROM pg_locks WHERE granted AND locktype=\'advisory\' AND age(now(), query_start) > interval \'10 min\'"', tool_name: 'psql' },
    { id: 'step-d2', order: 2, action: 'Pause PgBouncer to drain active connections', command: 'psql -p 6432 pgbouncer -c "PAUSE payment_db"', tool_name: 'psql' },
    { id: 'step-d3', order: 3, action: 'Resume PgBouncer with fresh connection pool', command: 'psql -p 6432 pgbouncer -c "RESUME payment_db"', tool_name: 'psql' },
    { id: 'step-d4', order: 4, action: 'Rebalance read replicas by updating PgBouncer backend weights', command: 'pgbouncer-admin rebalance --pool=payment_db --strategy=round-robin', tool_name: 'pgbouncer-admin' },
    { id: 'step-d5', order: 5, action: 'Verify Ledger-DB connection pool utilization is below 70%', command: 'psql -p 6432 pgbouncer -c "SHOW POOLS" | grep payment_db', tool_name: 'psql' },
  ];

  for (const s of drainSteps) {
    await executeWriteQuery(tenantId, `seed:step-${s.id}`, `
      MERGE (st:Step {id: $id})
      SET st.order_num = $order, st.action = $action, st.command = $command, st.tool_name = $tool_name
    `, { ...s, order: s.order });
  }

  await executeWriteQuery(tenantId, 'seed:proc-drain-applies-ledger', `
    MATCH (p:Procedure {id: 'proc-drain-ledger-pool'}), (s:Service {id: 'svc-ledger-db'})
    MERGE (p)-[:APPLIES_TO]->(s)
  `);
  await executeWriteQuery(tenantId, 'seed:proc-drain-applies-gw', `
    MATCH (p:Procedure {id: 'proc-drain-ledger-pool'}), (s:Service {id: 'svc-payment-gw'})
    MERGE (p)-[:APPLIES_TO]->(s)
  `);
  await executeWriteQuery(tenantId, 'seed:proc-drain-start', `
    MATCH (p:Procedure {id: 'proc-drain-ledger-pool'}), (st:Step {id: 'step-d1'})
    MERGE (p)-[:START_STEP]->(st)
  `);

  for (let i = 0; i < drainSteps.length - 1; i++) {
    await executeWriteQuery(tenantId, `seed:step-chain-d${i}`, `
      MATCH (a:Step {id: $fromId}), (b:Step {id: $toId})
      MERGE (a)-[:NEXT_STEP]->(b)
    `, { fromId: drainSteps[i].id, toId: drainSteps[i + 1].id });
  }

  // High confidence resolution edges
  await executeWriteQuery(tenantId, 'seed:proc-drain-resolution-ledger', `
    MATCH (p:Procedure {id: 'proc-drain-ledger-pool'}), (s:Service {id: 'svc-ledger-db'})
    MERGE (p)-[r:LED_TO_RESOLUTION]->(s)
    SET r.success_count = 6, r.fail_count = 1, r.confidence_weight = 0.86,
        r.last_used = '2026-10-10T09:18:00Z'
  `);
  await executeWriteQuery(tenantId, 'seed:proc-drain-resolution-gw', `
    MATCH (p:Procedure {id: 'proc-drain-ledger-pool'}), (s:Service {id: 'svc-payment-gw'})
    MERGE (p)-[r:LED_TO_RESOLUTION]->(s)
    SET r.success_count = 6, r.fail_count = 1, r.confidence_weight = 0.86,
        r.last_used = '2026-10-10T09:18:00Z'
  `);

  // ── Agent Coordination: Historical Handoff ──

  await executeWriteQuery(tenantId, 'seed:taskstate-01', `
    MERGE (ts:TaskState {id: 'task-001'})
    SET ts.session_id = 'sess-01',
        ts.status = 'resolved',
        ts.hypothesis = 'Ledger-DB connection pool exhaustion caused by stale advisory locks from batch reconciliation',
        ts.blast_radius_json = '["svc-payment-gw","svc-ledger-db","svc-fraud-engine"]',
        ts.selected_procedure_id = 'proc-drain-ledger-pool',
        ts.updated_at = '2026-10-10T09:18:00Z'
  `);

  // Triage created the task state
  await executeWriteQuery(tenantId, 'seed:agent-created-task', `
    MATCH (a:Agent {id: 'agent-triage'}), (ts:TaskState {id: 'task-001'})
    MERGE (a)-[:CREATED_STATE]->(ts)
  `);

  // Task state investigating services
  await executeWriteQuery(tenantId, 'seed:task-investigating-gw', `
    MATCH (ts:TaskState {id: 'task-001'}), (s:Service {id: 'svc-payment-gw'})
    MERGE (ts)-[:INVESTIGATING]->(s)
  `);
  await executeWriteQuery(tenantId, 'seed:task-investigating-ledger', `
    MATCH (ts:TaskState {id: 'task-001'}), (s:Service {id: 'svc-ledger-db'})
    MERGE (ts)-[:INVESTIGATING]->(s)
  `);

  // Handoff chain: triage -> investigator -> commander
  await executeWriteQuery(tenantId, 'seed:handoff-triage-to-investigator', `
    MATCH (ts:TaskState {id: 'task-001'}), (a:Agent {id: 'agent-investigator'})
    MERGE (ts)-[h:HANDED_OFF_TO]->(a)
    SET h.reason = 'Blast radius computed. 3 services in impact zone. Handing off for deep root-cause analysis.',
        h.context_summary = 'Payment-Gateway 504 spike. Hard deps: Auth-Service, Ledger-DB. Initial hypothesis: DB connection pool exhaustion.',
        h.timestamp = '2026-10-10T09:15:50Z'
  `);

  await executeWriteQuery(tenantId, 'seed:taskstate-02', `
    MERGE (ts:TaskState {id: 'task-002'})
    SET ts.session_id = 'sess-01',
        ts.status = 'resolved',
        ts.hypothesis = 'Root cause confirmed: PgBouncer stale locks. Procedural remediation required.',
        ts.blast_radius_json = '["svc-payment-gw","svc-ledger-db"]',
        ts.selected_procedure_id = 'proc-drain-ledger-pool',
        ts.updated_at = '2026-10-10T09:17:00Z'
  `);

  await executeWriteQuery(tenantId, 'seed:investigator-created-task2', `
    MATCH (a:Agent {id: 'agent-investigator'}), (ts:TaskState {id: 'task-002'})
    MERGE (a)-[:CREATED_STATE]->(ts)
  `);

  await executeWriteQuery(tenantId, 'seed:handoff-investigator-to-commander', `
    MATCH (ts:TaskState {id: 'task-002'}), (a:Agent {id: 'agent-commander'})
    MERGE (ts)-[h:HANDED_OFF_TO]->(a)
    SET h.reason = 'Root cause isolated: PgBouncer stale advisory locks. Recommended procedure: proc-drain-ledger-pool (confidence: 0.86).',
        h.context_summary = 'Ledger-DB PgBouncer at 498/500 connections. 47 stale advisory locks > 30 min. Procedure proc-drain-ledger-pool has 86% historical success rate.',
        h.timestamp = '2026-10-10T09:17:15Z'
  `);
}

// ═══════════════════════════════════════════════════════════════════════════
// NEBULA-CLOUD SEED DATA
// ═══════════════════════════════════════════════════════════════════════════

async function seedNebulaCloud(tenantId: string): Promise<void> {
  // ── Teams ──
  await executeWriteQuery(tenantId, 'seed:team-infra', `
    MERGE (t:Team {id: 'team-infra'})
    SET t.name = 'Infrastructure SRE', t.oncall_channel = '#oncall-infra'
  `);
  await executeWriteQuery(tenantId, 'seed:team-data', `
    MERGE (t:Team {id: 'team-data'})
    SET t.name = 'Data Platform', t.oncall_channel = '#oncall-data'
  `);
  await executeWriteQuery(tenantId, 'seed:team-billing', `
    MERGE (t:Team {id: 'team-billing'})
    SET t.name = 'Billing Operations', t.oncall_channel = '#oncall-billing'
  `);

  // ── Services ──
  const services = [
    { id: 'svc-api-ingress', name: 'API-Ingress', tier: 'critical', owner_team: 'team-infra', language: 'Envoy/Go', status: 'healthy' },
    { id: 'svc-auth-proxy', name: 'Auth-Proxy', tier: 'critical', owner_team: 'team-infra', language: 'Rust', status: 'healthy' },
    { id: 'svc-k8s-scheduler', name: 'K8s-Scheduler', tier: 'critical', owner_team: 'team-infra', language: 'Go', status: 'healthy' },
    { id: 'svc-vector-store', name: 'Vector-Store', tier: 'standard', owner_team: 'team-data', language: 'Python/FAISS', status: 'healthy' },
    { id: 'svc-billing-worker', name: 'Billing-Worker', tier: 'standard', owner_team: 'team-billing', language: 'TypeScript', status: 'healthy' },
  ];

  for (const svc of services) {
    await executeWriteQuery(tenantId, `seed:service-${svc.id}`, `
      MERGE (s:Service {id: $id})
      SET s.name = $name, s.tier = $tier, s.owner_team = $owner_team,
          s.language = $language, s.status = $status
    `, svc);
  }

  // ── Team Ownership ──
  await executeWriteQuery(tenantId, 'seed:owns-infra', `
    MATCH (t:Team {id: 'team-infra'}), (s:Service)
    WHERE s.owner_team = 'team-infra'
    MERGE (t)-[:OWNS]->(s)
  `);
  await executeWriteQuery(tenantId, 'seed:owns-data', `
    MATCH (t:Team {id: 'team-data'}), (s:Service)
    WHERE s.owner_team = 'team-data'
    MERGE (t)-[:OWNS]->(s)
  `);
  await executeWriteQuery(tenantId, 'seed:owns-billing', `
    MATCH (t:Team {id: 'team-billing'}), (s:Service)
    WHERE s.owner_team = 'team-billing'
    MERGE (t)-[:OWNS]->(s)
  `);

  // ── Service Dependencies ──
  const deps = [
    { from: 'svc-api-ingress', to: 'svc-auth-proxy', criticality: 'hard', protocol: 'mTLS/gRPC' },
    { from: 'svc-api-ingress', to: 'svc-k8s-scheduler', criticality: 'hard', protocol: 'Kubernetes API' },
    { from: 'svc-api-ingress', to: 'svc-vector-store', criticality: 'soft', protocol: 'HTTP/2' },
    { from: 'svc-api-ingress', to: 'svc-billing-worker', criticality: 'soft', protocol: 'gRPC' },
    { from: 'svc-k8s-scheduler', to: 'svc-vector-store', criticality: 'soft', protocol: 'gRPC' },
    { from: 'svc-billing-worker', to: 'svc-auth-proxy', criticality: 'hard', protocol: 'mTLS' },
  ];

  for (const d of deps) {
    await executeWriteQuery(tenantId, `seed:dep-${d.from}->${d.to}`, `
      MATCH (a:Service {id: $from}), (b:Service {id: $to})
      MERGE (a)-[r:DEPENDS_ON]->(b)
      SET r.criticality = $criticality, r.protocol = $protocol
    `, d);
  }

  // ── Episodic Memory: Past Incident ──
  await executeWriteQuery(tenantId, 'seed:session-n01', `
    MERGE (s:Session {id: 'sess-n01'})
    SET s.title = 'API-Ingress Certificate Expiry Cascade',
        s.started_at = '2026-10-14T03:00:00Z',
        s.user_engineer = 'alex.chen@nebula.io'
  `);

  const nebulaTurns = [
    { id: 'turn-n01-01', role: 'user', content: 'All API calls returning TLS handshake failures. Complete outage on API-Ingress.', timestamp: '2026-10-14T03:00:30Z' },
    { id: 'turn-n01-02', role: 'agent-triage', content: 'Critical: API-Ingress is the sole entry point. Blast radius: ALL downstream services. Checking certificate status.', timestamp: '2026-10-14T03:00:45Z' },
    { id: 'turn-n01-03', role: 'agent-investigator', content: 'mTLS certificate for API-Ingress expired 2 hours ago. Auth-Proxy also reports certificate validation failures. Root cause: cert-manager CRD was misconfigured after last Kubernetes upgrade.', timestamp: '2026-10-14T03:01:30Z' },
    { id: 'turn-n01-04', role: 'agent-commander', content: 'Emergency cert rotation executed. Patched cert-manager CRD. All services restored within 8 minutes.', timestamp: '2026-10-14T03:09:00Z' },
  ];

  for (let i = 0; i < nebulaTurns.length; i++) {
    const t = nebulaTurns[i];
    await executeWriteQuery(tenantId, `seed:turn-${t.id}`, `
      MERGE (turn:Turn {id: $id})
      SET turn.role = $role, turn.content = $content, turn.timestamp = $timestamp
    `, t);
    await executeWriteQuery(tenantId, `seed:session-turn-${t.id}`, `
      MATCH (s:Session {id: 'sess-n01'}), (turn:Turn {id: $id})
      MERGE (s)-[:HAS_TURN]->(turn)
    `, { id: t.id });
    if (i > 0) {
      await executeWriteQuery(tenantId, `seed:turn-chain-${t.id}`, `
        MATCH (prev:Turn {id: $prevId}), (curr:Turn {id: $currId})
        MERGE (prev)-[:NEXT_TURN]->(curr)
      `, { prevId: nebulaTurns[i - 1].id, currId: t.id });
    }
  }

  await executeWriteQuery(tenantId, 'seed:episode-n01', `
    MERGE (ep:Episode {id: 'ep-n01'})
    SET ep.session_id = 'sess-n01',
        ep.symptom = 'Complete API outage — TLS handshake failures on all endpoints',
        ep.root_cause = 'mTLS certificate for API-Ingress expired due to misconfigured cert-manager CRD after Kubernetes upgrade',
        ep.summary = 'API-Ingress certificate expiry caused complete outage. cert-manager CRD was misconfigured after K8s upgrade, preventing auto-renewal.',
        ep.resolved = true,
        ep.timestamp = '2026-10-14T03:09:30Z'
  `);

  await executeWriteQuery(tenantId, 'seed:episode-n01-affected', `
    MATCH (ep:Episode {id: 'ep-n01'}), (s:Service {id: 'svc-api-ingress'})
    MERGE (ep)-[:AFFECTED]->(s)
  `);
  await executeWriteQuery(tenantId, 'seed:episode-n01-recorded', `
    MATCH (ep:Episode {id: 'ep-n01'}), (turn:Turn {id: 'turn-n01-04'})
    MERGE (turn)-[:RECORDED_EPISODE]->(ep)
  `);

  // ── Procedural Memory ──
  await executeWriteQuery(tenantId, 'seed:proc-cert-rotate', `
    MERGE (p:Procedure {id: 'proc-cert-rotate'})
    SET p.name = 'Emergency Certificate Rotation & cert-manager CRD Patch',
        p.symptom_pattern = 'TLS handshake failure OR certificate expiry on ingress',
        p.target_service_id = 'svc-api-ingress'
  `);

  const certSteps = [
    { id: 'step-c1', order: 1, action: 'Generate emergency self-signed certificate', command: 'openssl req -x509 -newkey rsa:4096 -nodes -keyout /tmp/emergency.key -out /tmp/emergency.crt -days 7', tool_name: 'openssl' },
    { id: 'step-c2', order: 2, action: 'Apply emergency certificate to API-Ingress', command: 'kubectl create secret tls api-ingress-tls --cert=/tmp/emergency.crt --key=/tmp/emergency.key --dry-run=client -o yaml | kubectl apply -f -', tool_name: 'kubectl' },
    { id: 'step-c3', order: 3, action: 'Restart API-Ingress pods to pick up new cert', command: 'kubectl rollout restart deploy/api-ingress', tool_name: 'kubectl' },
    { id: 'step-c4', order: 4, action: 'Patch cert-manager CRD with correct issuer reference', command: 'kubectl apply -f cert-manager-issuer-fix.yaml', tool_name: 'kubectl' },
  ];

  for (const s of certSteps) {
    await executeWriteQuery(tenantId, `seed:step-${s.id}`, `
      MERGE (st:Step {id: $id})
      SET st.order_num = $order, st.action = $action, st.command = $command, st.tool_name = $tool_name
    `, { ...s, order: s.order });
  }

  await executeWriteQuery(tenantId, 'seed:proc-cert-applies', `
    MATCH (p:Procedure {id: 'proc-cert-rotate'}), (s:Service {id: 'svc-api-ingress'})
    MERGE (p)-[:APPLIES_TO]->(s)
  `);
  await executeWriteQuery(tenantId, 'seed:proc-cert-start', `
    MATCH (p:Procedure {id: 'proc-cert-rotate'}), (st:Step {id: 'step-c1'})
    MERGE (p)-[:START_STEP]->(st)
  `);

  for (let i = 0; i < certSteps.length - 1; i++) {
    await executeWriteQuery(tenantId, `seed:step-chain-c${i}`, `
      MATCH (a:Step {id: $fromId}), (b:Step {id: $toId})
      MERGE (a)-[:NEXT_STEP]->(b)
    `, { fromId: certSteps[i].id, toId: certSteps[i + 1].id });
  }

  await executeWriteQuery(tenantId, 'seed:proc-cert-resolution', `
    MATCH (p:Procedure {id: 'proc-cert-rotate'}), (s:Service {id: 'svc-api-ingress'})
    MERGE (p)-[r:LED_TO_RESOLUTION]->(s)
    SET r.success_count = 3, r.fail_count = 0, r.confidence_weight = 0.95,
        r.last_used = '2026-10-14T03:09:00Z'
  `);

  // ── Agent Coordination ──
  await executeWriteQuery(tenantId, 'seed:taskstate-n01', `
    MERGE (ts:TaskState {id: 'task-n01'})
    SET ts.session_id = 'sess-n01',
        ts.status = 'resolved',
        ts.hypothesis = 'mTLS certificate expiry on API-Ingress caused by cert-manager CRD misconfiguration',
        ts.blast_radius_json = '["svc-api-ingress","svc-auth-proxy","svc-k8s-scheduler","svc-vector-store","svc-billing-worker"]',
        ts.selected_procedure_id = 'proc-cert-rotate',
        ts.updated_at = '2026-10-14T03:09:00Z'
  `);

  await executeWriteQuery(tenantId, 'seed:agent-created-task-n01', `
    MATCH (a:Agent {id: 'agent-triage'}), (ts:TaskState {id: 'task-n01'})
    MERGE (a)-[:CREATED_STATE]->(ts)
  `);

  await executeWriteQuery(tenantId, 'seed:task-n01-investigating', `
    MATCH (ts:TaskState {id: 'task-n01'}), (s:Service {id: 'svc-api-ingress'})
    MERGE (ts)-[:INVESTIGATING]->(s)
  `);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SEED ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════

export type SeedableTenant = 'acme-fintech' | 'nebula-cloud';

const TENANT_SEEDERS: Record<SeedableTenant, (tenantId: string) => Promise<void>> = {
  'acme-fintech': seedAcmeFintech,
  'nebula-cloud': seedNebulaCloud,
};

export async function seedTenantGraph(
  tenantId: SeedableTenant,
  reset: boolean = false
): Promise<{ success: boolean; tenantId: string; message: string }> {
  try {
    if (reset) {
      await resetTenantGraph(tenantId);
    }

    // Initialize schema indexes
    await initializeSchemaIndexes(tenantId);

    // Seed agents (shared across tenants)
    await seedAgents(tenantId);

    // Seed tenant-specific data
    const seeder = TENANT_SEEDERS[tenantId];
    if (!seeder) {
      return { success: false, tenantId, message: `Unknown tenant: ${tenantId}` };
    }

    await seeder(tenantId);

    return {
      success: true,
      tenantId,
      message: `Successfully seeded tenant graph "synapse_tenant_${tenantId}" with full cognitive data model.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, tenantId, message: `Seed failed: ${message}` };
  }
}
