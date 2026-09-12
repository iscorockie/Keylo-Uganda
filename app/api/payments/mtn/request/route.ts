import { NextResponse } from 'next/server';
import { requestMtnPayment } from '../../../../../lib/payments';
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!Number.isFinite(body.amount) || body.amount <= 0 || !body.phone || !body.dealId) return NextResponse.json({ error: 'amount, phone and dealId are required' }, { status: 400 });
    return NextResponse.json(await requestMtnPayment({ amount: Number(body.amount), phone: body.phone, dealId: body.dealId, message: body.message }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Payment request failed' }, { status: 502 }); }
}
