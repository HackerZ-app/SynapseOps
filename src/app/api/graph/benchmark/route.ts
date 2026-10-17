/**
 * POST /api/graph/benchmark
 *
 * High-Concurrency Read/Write Swarm Benchmark Engine for FalkorDB.
 *
 * Demonstrates:
 *   1. Track 2 criteria: High-concurrency reads and writes against FalkorDB graphs.
 *   2. Track 2 criteria: Separate memory per tenant under concurrent load.
 *
 * Executes a burst of N parallel operations using Promise.all across both
 * `acme-fintech` and `nebula-cloud` graphs simultaneously, measuring
 * wall-clock throughput, p95 latency, and tenant isolation integrity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeReadQuery, executeWriteQuery } from '@/lib/falkordb';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const primaryTenant = body.tenantId || 'acme-fintech';
    const otherTenant = primaryTenant === 'acme-fintech' ? 'nebula-cloud' : 'acme-fintech';
    const concurrencyLevel = Math.min(Math.max(Number(body.concurrencyLevel) || 24, 8), 100);

    const startTime = performance.now();
    const latencies: number[] = [];
    let readCount = 0;
    let writeCount = 0;

    // Build the concurrent tasks array
    // Half against primaryTenant, half against otherTenant (proving simultaneous multi-tenant load)
    const tasks: Array<Promise<{ type: 'READ' | 'WRITE'; tenant: string; latencyMs: number; success: boolean; dataSample?: unknown }>> = [];

    for (let i = 0; i < concurrencyLevel; i++) {
      const isPrimary = i % 2 === 0;
      const targetTenant = isPrimary ? primaryTenant : otherTenant;
      const opIndex = i % 4;

      if (opIndex === 0) {
        // Op 0: Multi-hop dependency traversal (READ)
        tasks.push(
          (async () => {
            const start = performance.now();
            const res = await executeReadQuery(
              targetTenant,
              `bench:dep-traversal-${i}`,
              `MATCH (s:Service)-[r:DEPENDS_ON*1..3]->(dep:Service)
               RETURN s.name AS src, dep.name AS target, length(r) AS depth LIMIT 10`
            );
            const latencyMs = Math.round((performance.now() - start) * 100) / 100;
            return {
              type: 'READ',
              tenant: targetTenant,
              latencyMs,
              success: true,
              dataSample: res.data[0] || null,
            };
          })()
        );
        readCount++;
      } else if (opIndex === 1) {
        // Op 1: Episodic memory cross-session lookup (READ)
        tasks.push(
          (async () => {
            const start = performance.now();
            const res = await executeReadQuery(
              targetTenant,
              `bench:episodic-lookup-${i}`,
              `MATCH (ep:Episode)-[:AFFECTED]->(s:Service)
               RETURN ep.id AS epId, s.name AS svcName, ep.summary AS summary LIMIT 5`
            );
            const latencyMs = Math.round((performance.now() - start) * 100) / 100;
            return {
              type: 'READ',
              tenant: targetTenant,
              latencyMs,
              success: true,
              dataSample: res.data[0] || null,
            };
          })()
        );
        readCount++;
      } else if (opIndex === 2) {
        // Op 2: Procedural confidence weights lookup (READ)
        tasks.push(
          (async () => {
            const start = performance.now();
            const res = await executeReadQuery(
              targetTenant,
              `bench:procedural-lookup-${i}`,
              `MATCH (p:Procedure)-[r:LED_TO_RESOLUTION]->(s:Service)
               RETURN p.name AS procName, s.name AS svcName, r.confidence_weight AS weight
               ORDER BY r.confidence_weight DESC LIMIT 5`
            );
            const latencyMs = Math.round((performance.now() - start) * 100) / 100;
            return {
              type: 'READ',
              tenant: targetTenant,
              latencyMs,
              success: true,
              dataSample: res.data[0] || null,
            };
          })()
        );
        readCount++;
      } else {
        // Op 3: Concurrent atomic Agent state ping / heartbeat (WRITE)
        tasks.push(
          (async () => {
            const start = performance.now();
            const res = await executeWriteQuery(
              targetTenant,
              `bench:agent-ping-${i}`,
              `MATCH (a:Agent {id: 'agent-triage'})
               SET a.last_benchmark_ping = $timestamp,
                   a.benchmark_counter = coalesce(a.benchmark_counter, 0) + 1
               RETURN a.id AS agentId, a.benchmark_counter AS counter`,
              { timestamp: new Date().toISOString() }
            );
            const latencyMs = Math.round((performance.now() - start) * 100) / 100;
            return {
              type: 'WRITE',
              tenant: targetTenant,
              latencyMs,
              success: true,
              dataSample: res.data[0] || null,
            };
          })()
        );
        writeCount++;
      }
    }

    // Execute entire parallel burst
    const results = await Promise.all(tasks);
    const wallClockMs = Math.round((performance.now() - startTime) * 100) / 100;

    // Latency metrics
    for (const r of results) {
      latencies.push(r.latencyMs);
    }
    latencies.sort((a, b) => a - b);

    const minLatencyMs = latencies[0] || 0;
    const maxLatencyMs = latencies[latencies.length - 1] || 0;
    const sumLatency = latencies.reduce((acc, l) => acc + l, 0);
    const avgLatencyMs = Math.round((sumLatency / (latencies.length || 1)) * 100) / 100;
    const p95Index = Math.min(Math.floor(latencies.length * 0.95), latencies.length - 1);
    const p95LatencyMs = latencies[p95Index] || 0;

    const throughputOpsPerSec =
      wallClockMs > 0
        ? Math.round((results.length / (wallClockMs / 1000.0)) * 10) / 10
        : results.length * 1000;

    // Verify tenant isolation under concurrent load
    // Check that primaryTenant queries only accessed primaryTenant nodes
    const primarySamples = results.filter((r) => r.tenant === 'acme-fintech');
    const nebulaSamples = results.filter((r) => r.tenant === 'nebula-cloud');

    let isolationIntegrity = true;
    for (const s of primarySamples) {
      const text = JSON.stringify(s.dataSample || '');
      if (text.includes('API-Ingress') || text.includes('K8s-Scheduler')) {
        isolationIntegrity = false;
      }
    }
    for (const s of nebulaSamples) {
      const text = JSON.stringify(s.dataSample || '');
      if (text.includes('Payment-Gateway') || text.includes('Ledger-DB')) {
        isolationIntegrity = false;
      }
    }

    return NextResponse.json({
      success: true,
      totalOperations: results.length,
      concurrencyLevel,
      wallClockMs,
      throughputOpsPerSec,
      metrics: {
        avgLatencyMs,
        p95LatencyMs,
        minLatencyMs,
        maxLatencyMs,
      },
      breakdown: {
        reads: readCount,
        writes: writeCount,
        tenantsTested: [primaryTenant, otherTenant],
      },
      tenantIsolationVerified: isolationIntegrity,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/graph/benchmark] Error:', message);
    return NextResponse.json(
      { error: `Benchmark execution failed: ${message}` },
      { status: 500 }
    );
  }
}
