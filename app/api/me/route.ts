import { NextResponse } from 'next/server';
import { requestContext } from '../../../lib/auth';
import { permissions } from '../../../lib/roles';
export async function GET(request: Request) { const { role, organizationId } = requestContext(request); return NextResponse.json({ role, organizationId, permissions: permissions[role] ?? [] }); }
