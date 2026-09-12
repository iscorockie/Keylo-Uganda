# KeyLo Uganda

A B2B underwriting and subscription-financing workspace for Kampala dealers, SACCOs, MFIs and fleet operators.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The intake preview recalculates the rule-based v1 score as vehicle and subscriber fields change.

## Architecture

- **Web app:** Next.js 14 + React + TypeScript. Mobile-first UI with a thin client interaction layer; the risk calculation is isolated in `lib/risk.ts` so it can move behind an API without changing the interface.
- **API / domain boundary (next step):** Next.js Route Handlers or a Node service for intake validation, scoring, decision approvals and exports. Add an adapter layer for MTN/Airtel mobile money, CRB and valuation providers. Providers should only return normalized signals, never raw credentials or unnecessary personal data.
- **Persistence:** PostgreSQL. `db/schema.sql` includes tenant-scoped organizations, users, vehicles, subscribers, deals, immutable score snapshots, decisions and audit events. Prisma or Drizzle can generate the typed data layer from this schema.
- **Security / compliance:** organization-level tenancy, RBAC, consent timestamps, hashed NIN/phone fields, encrypted provider payloads, append-only audit events and explicit model versioning. Add retention/deletion workflows and approval separation before production. Confirm Bank of Uganda, UMRA, PDPO and Traffic & Road Safety Act obligations with local counsel.

## Project layout

```
app/                 Next app shell, dashboard page and styling
lib/risk.ts          Pure rule-based asset + subscriber scoring engine v1
db/schema.sql        PostgreSQL tenancy, consent, signal and underwriting schema
docs/integrations.md  gnuGrid, MTN MoMo and Airtel integration boundary
```

## MVP scoring logic

The preview blends **45% asset** and **55% subscriber** score. It considers vehicle age, mileage, local brand liquidity, declared value, income type, mobile-money activity and CRB status. Tiers are A (75+), B (58–74), C (42–57), Decline (<42). The recommendation includes term, deposit, monthly access fee and indicative margin. This is a transparent prototype, not a credit decision; thresholds and pricing must be configured per lender and calibrated on approved/repayment outcomes.

## Recommended next build slices

1. Persist draft assessments and add authentication / organization roles.
2. Add consented signal ingestion adapters and a provider status panel.
3. Add decision approval, conditions, JSON export and server-generated PDF.
4. Add configurable policy tables and scorecards per organization, with champion/challenger model versions.
5. Add monitoring for drift, adverse outcomes, overrides and fairness across informal-income segments.
