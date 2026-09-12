import { NextResponse } from 'next/server';
import { requirePermission } from '../../../../lib/auth';
export async function POST(request: Request) {
  const access = requirePermission(request, 'consent:request');
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null);
  if (!body?.consentId || !body?.otp) return NextResponse.json({ error: 'consentId and otp are required' }, { status: 400 });
  if (process.env.NODE_ENV !== 'production' && body.otp !== '123456') return NextResponse.json({ error: 'Invalid OTP' }, { status: 422 });
  return NextResponse.json({ consentId: body.consentId, status: 'VERIFIED', verifiedAt: new Date().toISOString(), organizationId: access.context.organizationId });
}
