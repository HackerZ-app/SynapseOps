/**
 * SynapseOps — Multi-Tenant FalkorDB Client with Live Cypher Telemetry
 *
 * Uses the official `falkordb` npm package for all graph operations.
 * Every tenant gets its own isolated graph: `synapse_tenant_<tenantId>`.
 * All queries are instrumented with sub-millisecond telemetry and logged
 * into a circular buffer for the War Room's Live Cypher Execution Log.
 */

import { FalkorDB, Graph } from 'falkordb';

// ─── Telemetry Types ────────────────────────────────────────────────────────

export interface QueryTelemetry {
  queryName: string;
  cypher: string;
  params: Record<string, unknown>;
  durationMs: number;
  timestamp: string;
  type: 'READ' | 'WRITE';
  tenantId: string;
}

export interface QueryResult<T = Record<string, unknown>[]> {
  data: T;
  metadata: Record<string, unknown>;
  telemetry: QueryTelemetry;
}

// ─── Circular Telemetry Buffer ──────────────────────────────────────────────

const TELEMETRY_BUFFER_SIZE = 50;
const telemetryBuffer: QueryTelemetry[] = [];

export function appendTelemetry(entry: QueryTelemetry): void {
  telemetryBuffer.push(entry);
  if (telemetryBuffer.length > TELEMETRY_BUFFER_SIZE) {
    telemetryBuffer.shift();
  }
}

export function getTelemetryLog(): QueryTelemetry[] {
  return [...telemetryBuffer];
}

export function clearTelemetry(): void {
  telemetryBuffer.length = 0;
}

// ─── FalkorDB Singleton Connection ──────────────────────────────────────────

let dbInstance: FalkorDB | null = null;

async function getDB(): Promise<FalkorDB> {
  if (!dbInstance) {
    dbInstance = await FalkorDB.connect({
      socket: {
        host: process.env.FALKORDB_HOST || '127.0.0.1',
        port: Number(process.env.FALKORDB_PORT || 6379),
      },
      username: process.env.FALKORDB_USERNAME || undefined,
      password: process.env.FALKORDB_PASSWORD || undefined,
    });
  }
  return dbInstance;
}

// ─── Multi-Tenant Graph Isolation ───────────────────────────────────────────

export async function getTenantGraph(tenantId: string): Promise<Graph> {
  const db = await getDB();
  const graphName = `synapse_tenant_${tenantId}`;
  return db.selectGraph(graphName);
}

// ─── Instrumented Query Helpers ─────────────────────────────────────────────

/**
 * Execute a WRITE query against a tenant's isolated FalkorDB graph.
 * Measures latency with performance.now() and logs telemetry.
 */
export async function executeWriteQuery(
  tenantId: string,
  queryName: string,
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<QueryResult> {
  const graph = await getTenantGraph(tenantId);
  const start = performance.now();

  const result = await graph.query(cypher, { params });

  const durationMs = Math.round((performance.now() - start) * 1000) / 1000;

  const telemetry: QueryTelemetry = {
    queryName,
    cypher,
    params,
    durationMs,
    timestamp: new Date().toISOString(),
    type: 'WRITE',
    tenantId,
  };

  appendTelemetry(telemetry);

  return {
    data: result.data ?? [],
    metadata: {
      statsText: result.metadata ?? null,
    },
    telemetry,
  };
}

/**
 * Execute a READ-ONLY query against a tenant's isolated FalkorDB graph.
 * Uses graph.roQuery() for read replicas when available.
 */
export async function executeReadQuery(
  tenantId: string,
  queryName: string,
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<QueryResult> {
  const graph = await getTenantGraph(tenantId);
  const start = performance.now();

  const result = await graph.roQuery(cypher, { params });

  const durationMs = Math.round((performance.now() - start) * 1000) / 1000;

  const telemetry: QueryTelemetry = {
    queryName,
    cypher,
    params,
    durationMs,
    timestamp: new Date().toISOString(),
    type: 'READ',
    tenantId,
  };

  appendTelemetry(telemetry);

  return {
    data: result.data ?? [],
    metadata: {
      statsText: result.metadata ?? null,
    },
    telemetry,
  };
}

// ─── Connection Cleanup ─────────────────────────────────────────────────────

export async function closeConnection(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}
