/**
 * POST /api/agents/investigate
 *
 * Runs the 3-Agent Autonomous Swarm (agent-triage -> agent-investigator -> agent-commander)
 * against the tenant's FalkorDB graph.
 *
 * Request Body:
 * {
 *   tenantId: string,
 *   sessionId?: string,
 *   alertText: string,
 *   userEngineer?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { runIncidentSwarm } from '@/lib/agent-swarm';
import { getTelemetryLog } from '@/lib/falkordb';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, sessionId, alertText, userEngineer } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing required field: tenantId' }, { status: 400 });
    }

    if (!alertText || typeof alertText !== 'string' || alertText.trim() === '') {
      return NextResponse.json({ error: 'Missing or invalid field: alertText' }, { status: 400 });
    }

    const activeSessionId = sessionId || `sess-${Date.now().toString(36)}`;

    const result = await runIncidentSwarm({
      tenantId,
      sessionId: activeSessionId,
      alertText: alertText.trim(),
      userEngineer,
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
        ...result,
        allTelemetry: getTelemetryLog(),
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/agents/investigate] Error:', message);
    return NextResponse.json(
      { error: `Incident swarm execution failed: ${message}` },
      { status: 500 }
    );
  }
}
