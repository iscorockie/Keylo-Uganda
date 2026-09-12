# KeyLo Uganda MVP foundations

This document locks the product decisions that must sit underneath the UI. The first release is an internal underwriting workspace for Uganda-based organizations, not a public borrower app.

## 1. Roles and permissions

| Capability | Super admin | Org admin | Underwriter | Dealer staff | Viewer |
|---|---:|---:|---:|---:|---:|
| Manage platform settings / organizations | Yes | No | No | No | No |
| Invite/manage users in own organization | Yes | Yes | No | No | No |
| Set organization risk appetite and pricing | Yes | Yes | No | No | No |
| Create a new deal | Yes | Yes | Yes | Yes | No |
| Edit draft deals | Yes | Yes | Yes | Own only | No |
| Trigger risk assessment / credit pull | Yes | Yes | Yes | Yes | No |
| View full score and explanation | Yes | Yes | Yes | Yes | Yes |
| Adjust recommended terms | Yes | Yes | Yes | Limited | No |
| Approve / decline deal | Yes | Yes | Yes | No | No |
| View organization deals | Yes | Yes | Yes | Own only | Yes |
| Portfolio reports / analytics | Yes | Yes | Yes | Limited | Yes |
| Export decision logs / audit | Yes | Yes | Yes | No | No |
| Manage consent records | Yes | Yes | View | View | No |
| Configure MoMo merchant accounts | Yes | Yes | No | No | No |
| View NIN / phone | Full | Full | Full | Masked | Masked |

Dealer staff can submit deals and initiate consent, but cannot make final credit decisions. Credit pulls, consent changes, policy changes and decisions are fully audited. Every API query is organization-scoped; super-admin cross-tenant access is an explicit audited support action.

## 2. Consent flow

1. Dealer or underwriter enters subscriber phone and NIN only after explaining the purpose, providers, data categories, retention and withdrawal channel.
2. KeyLo sends a one-time password to the subscriber’s phone. Digital signature or a scanned physical consent form is an assisted fallback; a form upload is access-controlled and virus-scanned.
3. Subscriber enters the OTP. Only a successful verification creates an active consent. KeyLo stores the deal, subscriber, purpose, provider, disclosure version, method, IP, initiating user, OTP verification time and consent id.
4. A provider call is blocked unless active consent covers the specific purpose. The score snapshot stores consent id, provider reference, retrieval time and expiry.
5. Withdrawal marks consent revoked, blocks future pulls, flags active decisions for review and starts a retention/deletion workflow. It does not silently erase legally required audit records.

This flow is designed around Uganda’s Personal Data Protection Act and must be reviewed with local counsel and each CRB/MNO’s terms before launch.

## 3. Primary happy path

**New assessment → Deal details → Consent → Score → Structure → Decision → Activation**

- Dealer staff creates a draft with vehicle, subscriber and organization context.
- Consent is captured and verified. Underwriter triggers the rule engine and provider adapters.
- Risk page shows asset score, subscriber score, tier, top three reason codes, signal freshness and missing data.
- Underwriter adjusts deposit, term or price within organization policy; every recalculation has a new version and is not destructive.
- Underwriter approves, declines or refers to an organization admin. The decision captures conditions and actor.
- For approved deals, an agreement is created, first payment request is sent through MTN/Airtel, and activation waits for a confirmed successful payment.

### Failure paths

- Missing/expired consent: stop with a consent task.
- Thin or stale data: return `REVIEW`, do not guess; permit manual evidence and conditions.
- Provider timeout: show unavailable source, retain self-declared scoring separately, never silently treat unavailable as clear.
- Decline: explain reasons and record an appeal/manual-review path; do not call payment.
- Failed payment: retry according to schedule, then grace period and human contact; no automated repossession action in v1.

## 4. Configurable pricing policy

The score maps to a policy row rather than hard-coded UI logic. The default v1 policy is:

| Tier | Score | Max term | Minimum deposit | Indicative margin |
|---|---:|---:|---:|---:|
| A | 75–100 | 24 months | 15% | 18.4% |
| B | 58–74 | 18 months | 20% | 23.7% |
| C | 42–57 | 12 months | 30% | 29.5% |
| Decline | 0–41 | — | — | — |

`lib/policy.ts` contains the pure policy implementation. Organization overrides are versioned JSON policy records with bounds enforced by the platform; underwriters cannot change policy in a deal. Monthly pricing is an indicative subscription quote, not an interest-rate disclosure.

## 5. Subscription lifecycle

`DRAFT → SCORED → APPROVED → PAYMENT_PENDING → ACTIVE → DELINQUENT → COMPLETED / EARLY_TERMINATED`

- Generate an installment schedule at activation.
- Request payment 3 days before due date; process a webhook or status poll as the source of truth.
- Retry on days 1 and 3 after failure, then enter a configurable grace period (default 7 days) and notify the organization.
- After grace, create a human review task. Repossession, suspension, fees and refunds are policy/legal workflows, not automatic MVP actions.
- Early termination calculates outstanding fees, deposit treatment and vehicle return condition; an underwriter/admin approves the final settlement.
- Provide a receipt for each successful payment and a downloadable statement from the ledger.

## 6. Asset valuation

`lib/vehicle.ts` starts with dated, reviewable Kampala assumptions for Premio, Vitz, Fielder, Wish, X-Trail and Fit, plus a conservative unknown-model band. The asset score considers age, mileage, liquidity and residual percentage. Each valuation must record source, valuation date, assumption version and manual override reason. Replace assumptions with a licensed valuation feed when available.

## 7. Organization onboarding

Super admin creates or approves an organization after business/KYC checks, selects type and country, then org admin configures policy within platform bounds. Org admin invites users by email, assigns role, and must connect payment credentials through a server-side secrets workflow. MoMo merchant onboarding is deliberately a later operational step; sandbox credentials are never entered into the browser.

## 8. Reporting and audit

V1 reports: pipeline by status, approval/decline/referral rates, average score and offer by tier, payment success/failure, outstanding installments, decisions by underwriter and branch. Exports include decision id, score version, factors, consent id, policy version, outcome, conditions and timestamps, but exclude raw NIN, phone, raw provider payload and secrets.

## 9. Explicit scope

**In:** internal users, draft intake, consent capture, mock/normalized provider signals, rule-based scoring, explainability, configurable offer preview, decision workflow, audit export and payment request foundation.

**Out:** public subscriber portal, mobile app, automated repossession, full accounting/general ledger, multi-currency, advanced ML, raw transaction ingestion, automated regulatory reporting and live provider credentials.

## 10. Technical and operational defaults

- Next.js + TypeScript, Route Handlers for the first API boundary, PostgreSQL for persistence.
- Email/password plus OTP or magic-link verification for users; subscriber OTP is consent proof, not a user account.
- Environment variables locally, managed secret store in deployment, no `NEXT_PUBLIC_` provider secrets.
- Mock adapters return deterministic fixtures with latency/error toggles; production adapters share the normalized signal interface.
- Every async action has idle/loading/success/empty/error states and a correlation id in server logs.
- Deploy web/API to a managed Next.js host, PostgreSQL to a managed regional provider, object storage for encrypted consent uploads, and a queue for webhooks/retries. Add backups, restore drills, monitoring and alerting before live lending.
