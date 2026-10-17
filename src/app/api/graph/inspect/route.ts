/**
 * GET /api/graph/inspect?tenantId=acme-fintech
 *
 * Runs parallel read-only Cypher queries against the tenant's FalkorDB graph
 * and returns full topology, summary counts, and telemetry log.
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeReadQuery, getTelemetryLog } from '@/lib/falkordb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId');

  if (!tenantId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: tenantId' },
      { status: 400 }
    );
  }

  try {
    // Run all read queries in parallel for maximum performance
    const [
      nodesResult,
      edgesResult,
      serviceCount,
      episodeCount,
      procedureCount,
      agentCount,
      taskStateCount,
      sessionCount,
      turnCount,
      stepCount,
      teamCount,
      proceduralWeights,
      serviceTopology,
      agentHandoffs,
    ] = await Promise.all([
      // ── All nodes ──
      executeReadQuery(
        tenantId,
        'inspect:all-nodes',
        `MATCH (n) RETURN id(n) AS nodeId, labels(n) AS labels, properties(n) AS props`
      ),

      // ── All edges ──
      executeReadQuery(
        tenantId,
        'inspect:all-edges',
        `MATCH (a)-[r]->(b) RETURN id(r) AS edgeId, id(a) AS sourceId, id(b) AS targetId, type(r) AS relType, properties(r) AS props`
      ),

      // ── Summary counts ──
      executeReadQuery(tenantId, 'inspect:count-services', `MATCH (s:Service) RETURN count(s) AS count`),
      executeReadQuery(tenantId, 'inspect:count-episodes', `MATCH (e:Episode) RETURN count(e) AS count`),
      executeReadQuery(tenantId, 'inspect:count-procedures', `MATCH (p:Procedure) RETURN count(p) AS count`),
      executeReadQuery(tenantId, 'inspect:count-agents', `MATCH (a:Agent) RETURN count(a) AS count`),
      executeReadQuery(tenantId, 'inspect:count-taskstates', `MATCH (ts:TaskState) RETURN count(ts) AS count`),
      executeReadQuery(tenantId, 'inspect:count-sessions', `MATCH (s:Session) RETURN count(s) AS count`),
      executeReadQuery(tenantId, 'inspect:count-turns', `MATCH (t:Turn) RETURN count(t) AS count`),
      executeReadQuery(tenantId, 'inspect:count-steps', `MATCH (s:Step) RETURN count(s) AS count`),
      executeReadQuery(tenantId, 'inspect:count-teams', `MATCH (t:Team) RETURN count(t) AS count`),

      // ── Procedural confidence weights ──
      executeReadQuery(
        tenantId,
        'inspect:procedural-weights',
        `MATCH (p:Procedure)-[r:LED_TO_RESOLUTION]->(s:Service)
         RETURN p.id AS procedureId, p.name AS procedureName,
                s.id AS serviceId, s.name AS serviceName,
                r.success_count AS successCount, r.fail_count AS failCount,
                r.confidence_weight AS confidenceWeight, r.last_used AS lastUsed
         ORDER BY r.confidence_weight DESC`
      ),

      // ── Service dependency topology ──
      executeReadQuery(
        tenantId,
        'inspect:service-topology',
        `MATCH (a:Service)-[r:DEPENDS_ON]->(b:Service)
         RETURN a.id AS sourceId, a.name AS sourceName,
                b.id AS targetId, b.name AS targetName,
                r.criticality AS criticality, r.protocol AS protocol`
      ),

      // ── Agent handoff chain ──
      executeReadQuery(
        tenantId,
        'inspect:agent-handoffs',
        `MATCH (ts:TaskState)-[h:HANDED_OFF_TO]->(a:Agent)
         RETURN ts.id AS taskStateId, ts.status AS taskStatus,
                a.id AS agentId, a.name AS agentName,
                h.reason AS reason, h.timestamp AS timestamp
         ORDER BY h.timestamp`
      ),
    ]);

    // Helper to safely serialize BigInt and nested objects
    const safeSerialize = <T>(data: T): T => {
      return JSON.parse(
        JSON.stringify(data, (_, value) =>
          typeof value === 'bigint' ? Number(value) : value
        )
      );
    };

    // Extract count helper
    const extractCount = (result: { data: Record<string, unknown>[] }): number => {
      const rows = result.data as unknown[];
      if (rows && rows.length > 0) {
        const row = rows[0];
        if (Array.isArray(row) && row.length > 0) return Number(row[0]) || 0;
        if (typeof row === 'object' && row !== null) {
          const values = Object.values(row as Record<string, unknown>);
          return Number(values[0]) || 0;
        }
      }
      return 0;
    };

    // Format nodes for visualization
    const nodes = (nodesResult.data as unknown[]).map((row: unknown) => {
      if (Array.isArray(row)) {
        return { id: row[0], labels: row[1], properties: row[2] };
      }
      if (typeof row === 'object' && row !== null) {
        const r = row as Record<string, unknown>;
        return {
          id: r.id ?? r.nodeId,
          labels: r.labels ?? (r.label ? [r.label] : []),
          properties: r.properties ?? r.props ?? {},
        };
      }
      return row;
    });

    // Format edges for visualization
    const edges = (edgesResult.data as unknown[]).map((row: unknown) => {
      if (Array.isArray(row)) {
        return { id: row[0], source: row[1], target: row[2], type: row[3], properties: row[4] };
      }
      if (typeof row === 'object' && row !== null) {
        const r = row as Record<string, unknown>;
        return {
          id: r.id ?? r.edgeId,
          source: r.source ?? r.sourceId,
          target: r.target ?? r.targetId,
          type: r.type ?? r.relType,
          properties: r.properties ?? r.props ?? {},
        };
      }
      return row;
    });

    return NextResponse.json(
      safeSerialize({
        tenantId,
        graphName: `synapse_tenant_${tenantId}`,
        topology: { nodes, edges },
        counts: {
          services: extractCount(serviceCount),
          episodes: extractCount(episodeCount),
          procedures: extractCount(procedureCount),
          agents: extractCount(agentCount),
          taskStates: extractCount(taskStateCount),
          sessions: extractCount(sessionCount),
          turns: extractCount(turnCount),
          steps: extractCount(stepCount),
          teams: extractCount(teamCount),
        },
        proceduralWeights: proceduralWeights.data,
        serviceTopology: serviceTopology.data,
        agentHandoffs: agentHandoffs.data,
        telemetry: getTelemetryLog(),
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Inspect failed: ${message}` },
      { status: 500 }
    );
  }
}
