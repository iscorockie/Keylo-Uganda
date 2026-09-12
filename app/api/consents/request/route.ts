import { NextResponse } from 'next/server';
import { requirePermission } from '../../../../lib/auth';
export async function POST(request: Request) {
  const access = requirePermission(request, 'consent:manage');
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null);
  if (!body?.dealId || !body?.phone) return NextResponse.json({ error: 'dealId and phone are required' }, { status: 400 });
  // Never return the OTP in production. This mock makes the UI flow testable.
  return NextResponse.json({ consentId: `CONSENT-${Date.now()}`, dealId: body.dealId, status: 'OTP_SENT', expiresInSeconds: 300, demoOtp: process.env.NODE_ENV === 'production' ? undefined : '123456' }, { status: 202 });
}
