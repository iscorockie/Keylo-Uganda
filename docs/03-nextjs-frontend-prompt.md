# Ready-to-Use Prompt: Scaffold the Keylo Uganda Next.js Frontend (RBAC-first)

> **Status: executed.** This prompt has been run — the resulting app lives in `web/` and
> implements the RBAC matrix, login, dashboard, deals (list/new/detail), OTP consent,
> risk assessment, decision workflow, and audit log. Two intentional deviations from the
> prompt below, made for sandbox portability:
>
> 1. **Database** — used Node's built-in `node:sqlite` (`web/src/lib/db.ts`) instead of
>    Prisma + Postgres, because Prisma's engine binaries can't be downloaded in this
>    environment. The Prisma schema is kept at `web/prisma/schema.prisma` as the
>    Postgres blueprint.
> 2. **Auth** — used a lightweight JWT cookie session (`jose` + `bcryptjs`) instead of
>    NextAuth, for the same reason (fewer moving parts, no external config). NextAuth can
>    be swapped in later behind `lib/session.ts`.
>
> The prompt below remains the canonical spec for rebuilding on the full stack.

Copy the block below (everything between the `---BEGIN---` / `---END---` markers) into
your coding agent. It is written to be pasted verbatim.

---BEGIN---

Build the **Keylo Uganda** vehicle-financing web app as a Next.js (App Router,
TypeScript) application with a role-based access control (RBAC) system. This is a
multi-tenant B2B app: dealers create and submit deals, underwriters make credit
decisions, and finance staff handle payments and activation.

## Tech stack (use exactly this)

- Next.js 14+ (App Router), TypeScript, React Server Components where sensible.
- Tailwind CSS for styling. shadcn/ui for components (install via `npx shadcn@latest init`).
- Prisma ORM + PostgreSQL (schema already designed — see below).
- NextAuth (Auth.js) v5 for authentication with credentials provider (or a stub email/password).
- Zod for validation. TanStack Query (or SWR) for client data fetching.
- Mock the external providers (gnuGrid, MTN MoMo, Airtel Money) behind interfaces so
  real integrations can be swapped in later.

## Roles & permissions (implement EXACTLY this matrix)

Permissions (dot-notation strings):
`org.users.manage`, `org.risk_rules.manage`, `deal.create`, `deal.read`, `deal.update`,
`deal.submit`, `consent.create`, `consent.read`, `consent.withdraw`, `credit.pull`,
`risk.read`, `decision.approve`, `decision.decline`, `decision.request_info`,
`payment.initiate`, `subscription.activate`, `audit.read`.

Roles → permissions:

| Role | Permissions |
|---|---|
| `org_admin` | all |
| `underwriter` | `deal.read`, `consent.read`, `consent.withdraw`, `credit.pull`, `risk.read`, `decision.approve`, `decision.decline`, `decision.request_info`, `audit.read` |
| `dealer_staff` | `deal.create`, `deal.read`, `deal.update`, `deal.submit`, `consent.create`, `consent.read`, `risk.read` |
| `finance` | `deal.read`, `payment.initiate`, `subscription.activate`, `risk.read`, `audit.read` |
| `viewer` | `deal.read`, `risk.read` |
| `auditor` | `deal.read`, `consent.read`, `risk.read`, `audit.read` |

Critical rule: **`dealer_staff` can create/submit deals but CANNOT pull credit or make
decisions.** `underwriter` is the decision-maker. Enforce this in BOTH the API layer and
the UI (hide/disable buttons, guard routes).

## Data model (implement as Prisma schema — this is the RBAC/audit slice)

- `Organization` (id, name, slug, status, settings Json, timestamps)
- `User` (id, email, fullName, phone?, passwordHash, status, timestamps)
- `Role` (id, key unique, name, description, isSystem)
- `Permission` (id, code unique, name, category, sensitive)
- `RolePermission` (roleId, permissionId)
- `OrganizationMember` (id, orgId, userId, roleId, status, invitedBy) — unique(orgId,userId)
- `AuditLog` (id, orgId, userId?, action, entityType, entityId, before Json?, after Json?,
  meta Json?, ipAddress?, userAgent?, createdAt)
- `Consent` (id, orgId, dealId, subscriberId, method, phone, nin, status, otpReference?,
  initiatedBy, grantedAt?, withdrawnAt?, withdrawnBy?, withdrawReason?, ipAddress,
  immutableHash, createdAt) — append-only
- `Deal` (id, orgId, vehicle Json/relation, subscriber Json/relation, status enum,
  proposed Json, decision Json?, createdAt, updatedAt)
- `RiskAssessment` (id, dealId, gnuGridScore?, internalAssetScore?, combinedScore, tier,
  explanation Json, recommended Json, providerRef, createdAt)
- `Payment` (id, dealId, channel enum `mtn|airtel`, amount, status, providerRef, timestamps)
- `Subscription` (id, dealId, status, schedule Json, activatedAt)
- `RiskRule` (id, orgId, config Json) — org risk-rule configuration

Deal `status` enum: `draft`, `submitted`, `consent_pending`, `in_review`, `approved`,
`declined`, `info_requested`, `activated`, `active`, `completed`, `cancelled`.

## Authentication & authorization utilities

- `lib/authz.ts` exporting `can(user, orgId, permission): Promise<boolean>` (resolves the
  effective permission set from the user's membership + role, honoring org overrides).
- `lib/audit.ts` exporting `audit({ action, entityType, entityId, before?, after?, meta? })`
  — called inside every sensitive route handler in the SAME transaction.
- Session exposes `{ userId, memberships: [{ orgId, role, permissions[] }] }`.

## API routes to implement (all org-scoped, permission-checked)

- Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- Org/members: `GET /api/orgs/:orgId`, `GET|POST /api/orgs/:orgId/members`,
  `PATCH|DELETE /api/orgs/:orgId/members/:memberId`, `GET /api/orgs/:orgId/roles`,
  `PUT /api/orgs/:orgId/risk-rules`
- Deals: `POST|GET /api/orgs/:orgId/deals`, `GET|PATCH /api/orgs/:orgId/deals/:dealId`,
  `POST /api/orgs/:orgId/deals/:dealId/submit`
- Consent: `POST /api/orgs/:orgId/deals/:dealId/consent/request`,
  `POST /api/orgs/:orgId/deals/:dealId/consent/verify`,
  `GET /api/orgs/:orgId/deals/:dealId/consent`,
  `POST /api/orgs/:orgId/deals/:dealId/consent/withdraw`
- Risk: `POST /api/orgs/:orgId/deals/:dealId/risk/pull`,
  `GET /api/orgs/:orgId/deals/:dealId/risk`,
  `PUT /api/orgs/:orgId/deals/:dealId/structure`
- Decision: `POST /api/orgs/:orgId/deals/:dealId/decision`
- Payments: `POST /api/orgs/:orgId/deals/:dealId/payments/initiate`,
  `GET /api/orgs/:orgId/deals/:dealId/payments`,
  `POST /api/orgs/:orgId/deals/:dealId/activate`
- Portfolio: `GET /api/orgs/:orgId/dashboard`, `GET /api/orgs/:orgId/portfolio`,
  `GET /api/orgs/:orgId/audit`

Enforce: `POST /risk/pull` returns `409 CONSENT_REQUIRED` unless a `granted`,
non-withdrawn consent exists for the deal. All decision/payment/consent/credit actions
write an `AuditLog` row atomically.

## Screens / pages to build

1. **Login** — email/password.
2. **Dashboard** (`/`) — pending decisions, deals in review, active portfolio count,
   monthly collections, recent activity. Cards/actions are role-filtered.
3. **Deals list** (`/deals`) — filters by status; "New deal" button only for
   `dealer_staff`/`org_admin`.
4. **Create deal** (`/deals/new`) — multi-step: vehicle details → subscriber details
   (NIN + phone) → proposed structure. Saves draft, then submit.
5. **Deal detail** (`/deals/:id`) — tabs: Overview, Consent, Risk, Decision, Payments,
   Activity (audit). Consent tab shows OTP request/verify flow and a **Withdraw** action
   (underwriter/admin). Risk tab shows combined score, tier, score explanation, and
   recommended structure with **live recalculation** sliders for deposit/term/monthly
   (underwriter only). Decision tab shows Approve/Decline/Request-info (underwriter only).
6. **Portfolio** (`/portfolio`) — active deals + payment status (delinquency flags).
7. **Settings** (`/settings`) — org members + role assignment, risk-rule config
   (`org_admin` only), and audit log viewer.

## RBAC in the UI (mandatory)

- A `usePermissions()` hook returns the current org's permission set for the logged-in user.
- Wrap privileged controls in a `<Can permission="credit.pull">` component (or guard
  with the hook) so dealer staff never see Approve/Decline/Withdraw/Pull buttons.
- Route-level guard: middleware or layout redirects users who lack `deal.read` away from
  `/deals`, and anyone lacking `org.users.manage` away from `/settings`.

## Acceptance criteria

1. Dealer staff can create, edit, submit a deal but sees NO credit-pull or decision UI
   and gets `403` if they call those endpoints directly.
2. Underwriter can pull credit (only after OTP consent granted), see combined score +
   tier + recommendation, tweak structure with live recalc, and approve/decline.
3. Approve → deal becomes `approved`; finance can initiate a (mock) MTN/Airtel
   Request-to-Pay and activate → `active` with a payment schedule.
4. Dashboard reflects the correct counts per role.
5. Every sensitive action appears in the audit log with before/after and actor/IP.
6. Seed script creates one org, and demo users for every role (password documented in
   the README) so each persona can be tested.

Also write a README covering: setup, env vars (`DATABASE_URL`, `NEXTAUTH_SECRET`, mock
provider toggles), how to seed, and the demo login credentials per role.

---END---

---

## Notes for whoever runs this prompt

1. **Reconcile with the real schema first.** The CSV (`table (4).csv`) you meant to
   attach didn't make it into the workspace — re-upload it and paste its tables in so the
   Prisma schema can map 1:1 to your existing DB instead of my inferred names.
2. **Start authz-first.** Build `lib/authz.ts` + seed roles/permissions + one guarded
   endpoint before the UI, so RBAC is structural rather than bolted on.
3. **Mock providers behind interfaces** (`GnuGridClient`, `MobileMoneyClient`) so the
   happy path is fully testable today and real gnuGrid/MTN/Airtel swap in later without
   touching UI or routes.
4. **Test the negative paths**: dealer calling `decision.approve` (expect 403), pulling
   credit without consent (expect 409), withdrawing consent then re-pulling (expect
   `CONSENT_WITHDRAWN`).
