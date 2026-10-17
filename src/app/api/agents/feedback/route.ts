/**
 * POST /api/agents/feedback
 *
 * Records human or autonomous remediation outcome ('SUCCESS' | 'FAILURE')
 * and triggers self-learning procedural edge weight mutation in FalkorDB.
 *
 * Also creates a new (:Episode) node linked to the service and turn chain
 * to enrich cross-session episodic memory.
 *
 * Request Body:
 * {
 *   tenantId: string,
 *   sessionId: string,
 *   taskId?: string,
 *   procedureId: string,
 *   targetServiceId: string,
 *   outcome: 'SUCCESS' | 'FAILURE',
 *   notes?: string,
 *   symptom?: string,
 *   rootCause?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { mutateProceduralMemory } from '@/lib/memory-engine';
import { getTelemetryLog } from '@/lib/falkordb';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      sessionId,
      taskId,
      procedureId,
      targetServiceId,
      outcome,
      notes,
      symptom,
      rootCause,
    } = body;

    if (!tenantId || !sessionId || !procedureId || !targetServiceId || !outcome) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, sessionId, procedureId, targetServiceId, outcome' },
        { status: 400 }
      );
    }

    if (outcome !== 'SUCCESS' && outcome !== 'FAILURE') {
      return NextResponse.json(
        { error: 'Invalid outcome. Must be either "SUCCESS" or "FAILURE"' },
        { status: 400 }
      );
    }

    const mutationResult = await mutateProceduralMemory(tenantId, {
      sessionId,
      taskId,
      procedureId,
      targetServiceId,
      outcome,
      notes,
      symptom,
      rootCause,
    });

    const safeSerialize = <T>(data: T): T => {
      return JSON.parse(
        JSON.stringify(data, (_, value) =>
          typeof value === 'bigint' ? Number(value) : value
        )
      );
    };

    return NextResponse.json(
      safeSerialize({
        success: true,
        message: `Procedural memory mutated for ${procedureId} on ${targetServiceId}. Outcome: ${outcome}.`,
        ...mutationResult,
        telemetry: getTelemetryLog(),
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/agents/feedback] Error:', message);
    return NextResponse.json(
      { error: `Procedural feedback mutation failed: ${message}` },
      { status: 500 }
    );
  }
}
