# Keylo Uganda

Vehicle-financing underwriting platform for Uganda: dealers create and submit deals,
underwriters make **consent-first** credit decisions, and finance activates mobile-money
payments — with role-based access control and a full audit trail.

## What's in this repo

| Path | What it is |
|---|---|
| `web/` | The Next.js 15 web app (RBAC, login, dashboard, deals, consent, risk, decisions, audit). See `web/README.md`. |
| `docs/` | `01-database-roles-permissions.md` (schema/RBAC), `02-api-endpoints.md` (API contract), `03-nextjs-frontend-prompt.md` (scaffold prompt). |
| `index.html` | Marketing landing page (vehicle financing). |
| `web/prisma/schema.prisma` | Reference schema — Postgres blueprint for production. |

## Quick start

```bash
cd web
npm install
npm run db:seed
npm run dev        # http://localhost:3000
```

Demo login (password `demo1234`): `dealer@keylo.ug`, `underwriter@keylo.ug`,
`finance@keylo.ug`, `admin@keylo.ug`, `auditor@keylo.ug`, `viewer@keylo.ug`.

## Core rules encoded in the system

1. **Dealer staff** create and submit deals but **cannot pull credit or make decisions**.
2. **Underwriter** is the decision-maker (`credit.pull`, `decision.*`, `consent.withdraw`).
3. **Consent is mandatory** — no score is requested before OTP consent is granted and recorded.
4. **Everything sensitive is audited** — consent, credit pulls and decisions write immutable
   audit entries with actor + IP.
