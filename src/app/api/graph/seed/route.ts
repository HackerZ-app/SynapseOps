/**
 * POST /api/graph/seed
 *
 * Seeds a tenant's isolated FalkorDB graph with enterprise data.
 * Body: { tenantId: "acme-fintech" | "nebula-cloud", reset?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { seedTenantGraph, SeedableTenant } from '@/lib/seed';
import { getTelemetryLog } from '@/lib/falkordb';

export const dynamic = 'force-dynamic';

const VALID_TENANTS: SeedableTenant[] = ['acme-fintech', 'nebula-cloud'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, reset = false } = body as { tenantId: string; reset?: boolean };

    if (!tenantId || !VALID_TENANTS.includes(tenantId as SeedableTenant)) {
      return NextResponse.json(
        { error: `Invalid tenantId. Must be one of: ${VALID_TENANTS.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await seedTenantGraph(tenantId as SeedableTenant, reset);

    const safeSerialize = <T>(data: T): T => {
      return JSON.parse(
        JSON.stringify(data, (_, value) =>
          typeof value === 'bigint' ? Number(value) : value
        )
      );
    };

    return NextResponse.json(
      safeSerialize({
        ...result,
        telemetry: getTelemetryLog(),
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Seed operation failed: ${message}` },
      { status: 500 }
    );
  }
}
