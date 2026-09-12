# Payment API integration

The server-side adapter in `lib/payments.ts` includes sandbox-oriented MTN Collections and Airtel Money collection requests. These endpoints intentionally return `PENDING` for MTN until a webhook or status lookup confirms the final result.

## Internal endpoints

```text
POST /api/payments/mtn/request
GET  /api/payments/mtn/status/{x-reference-id}
POST /api/payments/airtel/request
```

Example request:

```json
{ "amount": 150000, "phone": "256772123456", "dealId": "KEYLO-SUB-20260912-001" }
```

Required server-only environment variables:

```text
MTN_BASE_URL=https://sandbox.momodeveloper.mtn.com
MTN_API_USER=...
MTN_API_KEY=...
MTN_SUBSCRIPTION_KEY=...
MTN_TARGET_ENVIRONMENT=sandbox
AIRTEL_BASE_URL=https://openapiuat.airtel.africa
AIRTEL_ACCESS_TOKEN=...
```

Never expose these values through `NEXT_PUBLIC_*` variables or browser code. Confirm the current provider paths and authentication requirements before production, since product versions can change. Normalize and validate Uganda MSISDNs server-side. Persist each request and callback in `payment_events`, enforce idempotency on provider reference, verify webhook signatures, and treat redirects as untrusted.

The MTN flow is: token → request-to-pay → webhook or status poll. Airtel follows the equivalent collection pattern. These payment APIs should not be treated as a source of raw credit history; use a licensed CRB or partner repayment feed for underwriting signals.
