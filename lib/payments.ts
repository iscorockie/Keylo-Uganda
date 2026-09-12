import { randomUUID } from 'crypto';

export type PaymentRequest = { amount: number; phone: string; dealId: string; message?: string };
const mtnBase = process.env.MTN_BASE_URL ?? 'https://sandbox.momodeveloper.mtn.com';

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

export async function mtnAccessToken() {
  const basic = Buffer.from(`${requireEnv('MTN_API_USER')}:${requireEnv('MTN_API_KEY')}`).toString('base64');
  const response = await fetch(`${mtnBase}/collection/token/`, {
    method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Ocp-Apim-Subscription-Key': requireEnv('MTN_SUBSCRIPTION_KEY'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: ''
  });
  if (!response.ok) throw new Error(`MTN token request failed: ${response.status}`);
  return (await response.json()).access_token as string;
}

export async function requestMtnPayment(input: PaymentRequest) {
  const referenceId = randomUUID();
  const token = await mtnAccessToken();
  const response = await fetch(`${mtnBase}/collection/v1_0/requesttopay`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Reference-Id': referenceId, 'X-Target-Environment': process.env.MTN_TARGET_ENVIRONMENT ?? 'sandbox', 'Ocp-Apim-Subscription-Key': requireEnv('MTN_SUBSCRIPTION_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: String(input.amount), currency: 'UGX', externalId: input.dealId, payer: { partyIdType: 'MSISDN', partyId: input.phone.replace(/\D/g, '') }, payerMessage: input.message ?? 'KeyLo vehicle subscription payment', payeeNote: `Deal ID: ${input.dealId}` })
  });
  if (response.status !== 202) throw new Error(`MTN request failed: ${response.status} ${await response.text()}`);
  return { provider: 'MTN', referenceId, status: 'PENDING' as const };
}

export async function checkMtnPayment(referenceId: string) {
  const token = await mtnAccessToken();
  const response = await fetch(`${mtnBase}/collection/v1_0/requesttopay/${encodeURIComponent(referenceId)}`, { headers: { Authorization: `Bearer ${token}`, 'X-Target-Environment': process.env.MTN_TARGET_ENVIRONMENT ?? 'sandbox', 'Ocp-Apim-Subscription-Key': requireEnv('MTN_SUBSCRIPTION_KEY') } });
  if (!response.ok) throw new Error(`MTN status request failed: ${response.status}`);
  return response.json();
}

export async function requestAirtelPayment(input: PaymentRequest) {
  const response = await fetch(`${process.env.AIRTEL_BASE_URL ?? 'https://openapiuat.airtel.africa'}/merchant/v1/payments/`, {
    method: 'POST', headers: { Authorization: `Bearer ${requireEnv('AIRTEL_ACCESS_TOKEN')}`, 'Content-Type': 'application/json', 'X-Country': 'UG', 'X-Currency': 'UGX' },
    body: JSON.stringify({ reference: input.dealId, subscriber: { country: 'UG', currency: 'UGX', msisdn: input.phone.replace(/\D/g, '') }, transaction: { amount: input.amount, country: 'UG', currency: 'UGX', id: input.dealId } })
  });
  if (!response.ok) throw new Error(`Airtel request failed: ${response.status} ${await response.text()}`);
  return response.json();
}
