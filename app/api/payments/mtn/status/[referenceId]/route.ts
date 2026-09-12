import { NextResponse } from 'next/server';
import { checkMtnPayment } from '../../../../../../lib/payments';
export async function GET(_: Request, { params }: { params: { referenceId: string } }) {
  try { return NextResponse.json(await checkMtnPayment(params.referenceId)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Status lookup failed' }, { status: 502 }); }
}
