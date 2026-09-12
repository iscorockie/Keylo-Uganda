# Keylo Uganda — API Endpoints (v1)

> Next.js App Router route handlers under `/api`. Every endpoint is:
> 1. **Authenticated** (session / JWT bearer).
> 2. **Org-scoped** — the `orgId` comes from the signed session (or an explicit
>    `X-Org-Id` header the server validates against the user's memberships).
> 3. **Authorized** via `can(user, orgId, permission)`.
>
> Convention: `409` = domain conflict (e.g. consent missing), `403` = authenticated but
> not authorized, `401` = not authenticated, `422` = validation error.
>
> A `◆` marks endpoints that **also write to `audit_logs`** (sensitive actions).

---

## 1. Auth & Session

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/auth/login` | Email + password → session cookie. Rate-limited. |
| `POST` | `/api/auth/logout` | Clears session. |
| `GET` | `/api/auth/me` | Returns `{ user, memberships:[{org, role, permissions[]}] }`. This is what the frontend uses to render RBAC-aware UI. |
| `POST` | `/api/auth/forgot-password` | Email reset link (v1: stub). |

---

## 2. Organizations & Members (RBAC admin)

Requires `org.users.manage`.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/orgs/:orgId` | Org profile + settings. |
| `GET` | `/api/orgs/:orgId/members` | List members w/ role. `audit.read` for role history. |
| `POST` ◆ | `/api/orgs/:orgId/members` | Invite `{ email, roleKey }`. |
| `PATCH` ◆ | `/api/orgs/:orgId/members/:memberId` | Change `{ roleKey, status }`. |
| `DELETE` ◆ | `/api/orgs/:orgId/members/:memberId` | Soft-remove (`status='removed'`). |
| `GET` | `/api/orgs/:orgId/roles` | Roles available to this org (+ overrides). |
| `PUT` ◆ | `/api/orgs/:orgId/risk-rules` | Upsert org risk-rule config (see §7). |

---

## 3. Deals (happy-path: create → submit)

`dealer_staff` creates/submits; `underwriter` + `org_admin` + `finance` read.

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/orgs/:orgId/deals` | Create draft. Body: `{ vehicle, subscriber, proposed }`. Requires `deal.create`. Returns `deal` with `status='draft'`. |
| `GET` | `/api/orgs/:orgId/deals` | List. Query filters: `status`, `assignee`, `subscriberNIN`, `page`. Requires `deal.read`. |
| `GET` | `/api/orgs/:orgId/deals/:dealId` | Detail incl. latest consent + risk summary. Requires `deal.read`. |
| `PATCH` | `/api/orgs/:orgId/deals/:dealId` | Edit draft only (403 if not `draft`). Requires `deal.update`. |
| `POST` | `/api/orgs/:orgId/deals/:dealId/submit` | `draft → submitted`. Requires `deal.submit`. |

### 3.1 Vehicle + subscriber (sub-resources)

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/orgs/:orgId/vehicles` | Create vehicle record (reused across deals). |
| `GET` | `/api/orgs/:orgId/subscribers` | Search by NIN/phone (for reuse). |
| `POST` | `/api/orgs/:orgId/subscribers` | Upsert subscriber `{ nin, phone, name }`. |

---

## 4. Consent Capture (must precede any score)

`dealer_staff` initiates; OTP is a stub provider in v1.

| Method | Path | Notes |
|---|---|---|
| `POST` ◆ | `/api/orgs/:orgId/deals/:dealId/consent/request` | Body `{ subscriberId, phone }`. Sends OTP, creates `consents` row `status='pending'`. Requires `consent.create`. |
| `POST` ◆ | `/api/orgs/:orgId/deals/:dealId/consent/verify` | Body `{ otp }`. On success: `status='granted'`, `granted_at=now()`, records `ip`, `initiated_by`, computes `immutable_hash`. Requires `consent.create`. |
| `GET` | `/api/orgs/:orgId/deals/:dealId/consent` | Consent status + history. Requires `consent.read`. |
| `POST` ◆ | `/api/orgs/:orgId/deals/:dealId/consent/withdraw` | Body `{ reason }`. Sets `withdrawn_at`, blocks future pulls. Requires `consent.withdraw`. |

**Invariant:** `POST /credit/pull` returns `409 {"code":"CONSENT_REQUIRED"}` unless a
`granted`, non-withdrawn consent exists for the deal.

---

## 5. Risk Assessment

| Method | Path | Notes |
|---|---|---|
| `POST` ◆ | `/api/orgs/:orgId/deals/:dealId/risk/pull` | Runs gnuGrid Mobile Score (mock in v1) + internal asset score. Requires `credit.pull` **and** valid consent. Persists result. |
| `GET` | `/api/orgs/:orgId/deals/:dealId/risk` | Combined score + tier + score explanation + recommended structure. Requires `risk.read`. |
| `PUT` ◆ | `/api/orgs/:orgId/deals/:dealId/structure` | Underwriter live recalc: body `{ deposit, termMonths, monthlyAmount }` → recomputed totals. Requires `risk.read` (edit) — logged. |

Sample risk response:

```json
{
  "dealId": "…",
  "combinedScore": 712,
  "tier": "A",
  "scores": {
    "gnuGrid": { "value": 640, "available": true, "ref": "mock-gg-01" },
    "internalAsset": { "value": 82, "weight": 0.4 }
  },
  "explanation": ["High mobile-money activity", "Asset value covers 60% of exposure"],
  "recommended": { "deposit": 0.25, "termMonths": 12, "monthlyAmount": 480000 }
}
```

---

## 6. Decision

`underwriter` only (`decision.*`).

| Method | Path | Notes |
|---|---|---|
| `POST` ◆ | `/api/orgs/:orgId/deals/:dealId/decision` | Body `{ type: 'approve' | 'decline' | 'request_info', reason?, structure? }`. Updates `deal.status`, writes full `before`/`after` to audit. Requires matching `decision.*`. |

Status transitions:

```
submitted ──approve──────────► approved ──activate──► active
    │
    ├──decline───────────────► declined
    └──request_info──────────► info_requested ──(dealer edits + resubmit)──► submitted
```

---

## 7. Payments & Activation

`finance` role.

| Method | Path | Notes |
|---|---|---|
| `POST` ◆ | `/api/orgs/:orgId/deals/:dealId/payments/initiate` | Body `{ channel: 'mtn'|'airtel', amount }`. MTN/Airtel Request-to-Pay (mock in v1). Requires `payment.initiate`. |
| `GET` | `/api/orgs/:orgId/deals/:dealId/payments` | Payment attempts + statuses. |
| `POST` ◆ | `/api/orgs/:orgId/deals/:dealId/activate` | `approved → active`, creates payment schedule. Requires `subscription.activate`. |
| `GET` | `/api/orgs/:orgId/subscriptions/:subId/schedule` | Payment schedule + status per installment. |

---

## 8. Dashboard & Portfolio

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/orgs/:orgId/dashboard` | `{ pendingDecisions, dealsInReview, activePortfolio, monthlyCollections, recentActivity[] }`. |
| `GET` | `/api/orgs/:orgId/portfolio` | Active deals + payment status (delinquency flags). |
| `GET` | `/api/orgs/:orgId/audit` | Full audit log. Requires `audit.read`. Query: `entityType`, `action`, `userId`, `from`, `to`. |

---

## 9. RBAC enforcement summary (who can call what)

| Endpoint group | `dealer_staff` | `underwriter` | `finance` | `org_admin` | `viewer` | `auditor` |
|---|---|---|---|---|---|---|
| Deals create/submit | ✅ | — | — | ✅ | — | — |
| Deals read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Consent create | ✅ | — | — | ✅ | — | — |
| Consent withdraw | — | ✅ | — | ✅ | — | — |
| Credit pull | ❌ | ✅ | — | ✅ | — | — |
| Decision (approve/decline) | ❌ | ✅ | — | ✅ | — | — |
| Payment initiate | — | — | ✅ | ✅ | — | — |
| Activate | — | — | ✅ | ✅ | — | — |
| Risk rules manage | — | — | — | ✅ | — | — |
| Members manage | — | — | — | ✅ | — | — |
| Audit read | — | ✅ | ✅ | ✅ | — | ✅ |

---

## 10. Error envelope (shared)

```json
{ "error": { "code": "FORBIDDEN", "message": "Missing permission: credit.pull" } }
```

Common codes: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONSENT_REQUIRED`,
`CONSENT_WITHDRAWN`, `INVALID_STATE` (bad status transition), `VALIDATION`, `PROVIDER_*`
(gnuGrid/MTN/Airtel failures — deal stays in current state, retryable).
