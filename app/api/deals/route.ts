import { NextResponse } from 'next/server';
import { requirePermission, requestContext } from '../../../lib/auth';

// Replace this fixture with a tenant-scoped repository once PostgreSQL is connected.
const demoDeals = [{ id: 'DEAL-8842', status: 'SCORED', vehicle: 'Toyota Premio', subscriber: '256•••482', tier: 'A', combinedScore: 82 }];

export async function GET(request: Request) {
  const access = requirePermission(request, 'deal:view');
  if (!access.ok) return access.response;
  return NextResponse.json({ organizationId: access.context.organizationId, data: demoDeals });
}
export async function POST(request: Request) {
  const access = requirePermission(request, 'deal:create');
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null);
  if (!body?.vehicle || !body?.subscriber) return NextResponse.json({ error: 'vehicle and subscriber are required' }, { status: 400 });
  return NextResponse.json({ id: `DEAL-${Date.now()}`, status: 'DRAFT', organizationId: requestContext(request).organizationId, ...body }, { status: 201 });
}
