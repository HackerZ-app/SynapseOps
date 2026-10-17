/**
 * GET /api/sessions?tenantId=acme-fintech
 * GET /api/sessions?tenantId=acme-fintech&sessionId=sess-01
 *
 * Queries FalkorDB for persistent cross-session incident history,
 * conversation turn chains, linked episodes, and multi-agent task state transitions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryAllSessions, querySessionDetails } from '@/lib/memory-engine';
import { getTelemetryLog } from '@/lib/falkordb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId');
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!tenantId) {
    return NextResponse.json({ error: 'Missing required query parameter: tenantId' }, { status: 400 });
  }

  const safeSerialize = <T>(data: T): T => {
    return JSON.parse(
      JSON.stringify(data, (_, value) =>
        typeof value === 'bigint' ? Number(value) : value
      )
    );
  };

  try {
    if (sessionId) {
      const details = await querySessionDetails(tenantId, sessionId);
      return NextResponse.json(
        safeSerialize({
          tenantId,
          sessionId,
          ...details,
          telemetry: getTelemetryLog(),
        })
      );
    }

    const sessions = await queryAllSessions(tenantId);
    return NextResponse.json(
      safeSerialize({
        tenantId,
        sessions,
        telemetry: getTelemetryLog(),
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/sessions] Error:', message);
    return NextResponse.json(
      { error: `Querying sessions failed: ${message}` },
      { status: 500 }
    );
  }
}
