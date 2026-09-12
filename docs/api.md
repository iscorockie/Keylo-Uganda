# Web app API examples

These Route Handlers are intentionally thin demo endpoints. They enforce permissions and organization context through the temporary `x-demo-role` and `x-organization-id` headers. Replace those headers with a signed session after authentication is added.

## Current endpoints

### Current user

```http
GET /api/me
```

Returns the role, organization id and effective permissions.

### Deals

```http
GET /api/deals
x-demo-role: UNDERWRITER
x-organization-id: org-kampala-auto

POST /api/deals
Content-Type: application/json
x-demo-role: DEALER_STAFF
x-organization-id: org-kampala-auto

{"vehicle":{"make":"Toyota","model":"Premio","year":2018},"subscriber":{"phone":"256772123456"}}
```

`GET` is available to all non-public roles; `POST` requires `deal:create`. Production queries must always include the organization id from the session, never from a user-supplied body.

### Consent OTP

```http
POST /api/consents/request
x-demo-role: DEALER_STAFF

{"dealId":"DEAL-8842","phone":"256772123456"}
```

Then:

```http
POST /api/consents/verify
x-demo-role: DEALER_STAFF

{"consentId":"CONSENT-...","otp":"123456"}
```

The development fixture uses `123456`; production must send and verify a real OTP, rate-limit attempts, hash OTPs, and never return the OTP in a response. Consent verification must persist the IP, actor, deal, disclosure version and timestamp in `data_consents`.

### Payment endpoints

See `docs/payment-api.md` for MTN and Airtel request-to-pay endpoints. Provider credentials remain server-only.

## Error contract

- `400`: invalid or missing input
- `401`: missing/invalid session (to be added with auth)
- `403`: authenticated user lacks the required permission
- `409`: invalid state transition or duplicate provider reference
- `422`: semantically invalid OTP or deal data
- `502`: provider unavailable

Every production response should include a correlation id; audit records should include the actor, organization, action, entity and policy/model version.
