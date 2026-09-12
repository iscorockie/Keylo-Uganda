# Keylo Uganda — Web App

Vehicle-financing underwriting platform: dealers create and submit deals, underwriters
make consent-first credit decisions, and finance activates payments — with role-based
access control (RBAC) and a full audit trail.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19, TypeScript |
| Styling | Tailwind CSS |
| Auth | JWT session cookie (via `jose`) + bcryptjs — swap NextAuth in later |
| Database | **Node built-in SQLite (`node:sqlite`)** — zero external engine, works offline |
| Validation | Zod |
| Providers | gnuGrid + MTN/Airtel **mocked** behind interfaces (see `src/lib/providers.ts`) |

> **Why `node:sqlite` and not Prisma?** The reference Prisma schema exists at
> `prisma/schema.prisma`, but the Prisma engine binaries are downloaded from
> `binaries.prisma.sh` at install time, which is blocked in some sandboxed/CI
> environments. Node 22 ships a built-in SQLite module that needs no download, so the
> data layer in `src/lib/db.ts` uses it directly. The Prisma schema remains the blueprint
> for a Postgres migration in production.

## Getting started

```bash
cd web
npm install
npm run db:seed      # creates SQLite DB + demo org/users/roles
npm run dev          # http://localhost:3000
```

### Demo accounts

Password for all accounts: **`demo1234`**

| Email | Role | What they can do |
|---|---|---|
| `dealer@keylo.ug` | Dealer staff | Create, edit, submit deals; capture OTP consent. **Cannot pull credit or decide.** |
| `underwriter@keylo.ug` | Underwriter | Pull credit, view scores, approve / decline / request info, withdraw consent. |
| `finance@keylo.ug` | Finance | Initiate payments, activate subscriptions. |
| `admin@keylo.ug` | Org admin | Everything, plus member & risk-rule management (permissions seeded). |
| `auditor@keylo.ug` | Auditor | Read-only + audit log. |
| `viewer@keylo.ug` | Viewer | Read-only. |

## Environment variables (`.env`)

| Var | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | SQLite file path (`file:./prisma/dev.db`) | `file:./prisma/dev.db` |
| `AUTH_SECRET` | JWT signing secret — **change in production** | dev value |
| `MOCK_GNUSCORE` | Use mock gnuGrid instead of real API | `true` |
| `MOCK_MOMO` | Use mock MTN/Airtel instead of real API | `true` |

## The happy path (try it)

1. Log in as `dealer@keylo.ug` → create a deal (vehicle + subscriber) → submit.
2. On the deal's **Consent** tab, send the OTP and verify it (the demo code is shown in-app).
3. Log in as `underwriter@keylo.ug` → on the **Risk** tab, run the credit pull → combined
   score + tier + recommended structure appear.
4. On the **Decision** tab, approve (or decline / request info).
5. Check the **Audit log** — every consent event, credit pull and decision is recorded
   with actor + IP.

### Negative paths that are enforced

- Dealer staff calling a credit pull or decision → `403 FORBIDDEN`.
- Credit pull without granted consent → `409 CONSENT_REQUIRED`.
- Withdrawn consent blocks future pulls.

## Project layout

```
src/
  app/
    (app)/                 # authenticated area (sidebar shell)
      dashboard/  deals/  deals/[dealId]/  deals/new/  audit/
    api/                   # route handlers (org-scoped, permission-checked)
    login/                 # login form
    page.tsx               # redirects to /dashboard or /login
  components/              # app-shell, deal-detail, new-deal-form, login-form, status-badge
  lib/
    db.ts                  # node:sqlite data layer + schema
    session.ts             # JWT cookie session
    authz.ts               # can(user, orgId, permission)
    audit.ts               # append-only audit writer
    risk.ts                # combined scoring + tiers
    providers.ts           # gnuGrid / MTN / Airtel mocks
    otp.ts                 # OTP issue/verify
db/seed.ts                 # seed script
prisma/schema.prisma       # reference schema (Postgres blueprint)
```

## Docs

- `../docs/01-database-roles-permissions.md` — RBAC/audit schema design
- `../docs/02-api-endpoints.md` — API contract
- `../docs/03-nextjs-frontend-prompt.md` — scaffold prompt this app was built from
