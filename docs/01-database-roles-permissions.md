# Keylo Uganda — Database: Roles, Permissions & Audit

> Target: PostgreSQL (Prisma ORM in the Next.js app). `uuid` PKs, `jsonb` for flexible
> metadata, `timestamptz` for everything. Enums via Postgres `CREATE TYPE`.
>
> This doc is the RBAC/audit slice of the schema. Domain tables (vehicles, deals,
> subscriptions, payments) are referenced where RBAC touches them; a full domain schema
> is in `02-api-endpoints.md`.

---

## 1. Role & Permission Model

### 1.1 Design principles

1. **Permissions are granular and additive** — a user's effective permissions are the
   union of all permissions across their assigned roles (within a given organization).
2. **Roles are scoped per organization** — a user can be a `dealer_staff` in one org and
   an `underwriter` in another. There is no global super-role.
3. **Sensitive actions are hard-gated by permission, not role name** — the code checks
   `can(user, "credit.pull")`, never `user.role === "underwriter"`. This keeps the audit
   trail clean and lets orgs tune their own rules.
4. **Everything sensitive is immutable + audited** — consent records and audit log rows
   are append-only (no `UPDATE`/`DELETE` paths exposed; enforced at the API layer, with
   `ON DELETE RESTRICT` at the FK layer).

### 1.2 Permission catalog (seed data)

| Code | Category | Description | Sensitive? |
|---|---|---|---|
| `org.users.manage` | org | Invite/remove members, assign roles | yes |
| `org.risk_rules.manage` | org | Create/edit org risk-rule configuration | yes |
| `deal.create` | deal | Create draft deals | no |
| `deal.read` | deal | View deals (scoped by role below) | no |
| `deal.update` | deal | Edit a draft deal | no |
| `deal.submit` | deal | Submit a deal for underwriting | no |
| `consent.create` | consent | Initiate OTP and record consent | yes |
| `consent.read` | consent | View consent records | no |
| `consent.withdraw` | consent | Record subscriber withdrawal, block future pulls | yes |
| `credit.pull` | risk | Request gnuGrid + internal score | **yes** |
| `risk.read` | risk | View risk scores, tiers, recommendations | no |
| `decision.approve` | decision | Final approve | **yes** |
| `decision.decline` | decision | Final decline | **yes** |
| `decision.request_info` | decision | Send back for more info | yes |
| `payment.initiate` | payment | Trigger MTN/Airtel Request-to-Pay | yes |
| `subscription.activate` | subscription | Activate deal → live subscription | yes |
| `audit.read` | audit | Read the org audit log | no |

### 1.3 Default roles → permissions mapping (seed data)

| Role | Assigned permissions |
|---|---|
| `org_admin` | **all** permissions (including `audit.read`) |
| `underwriter` | `deal.read`, `consent.read`, `consent.withdraw`, `credit.pull`, `risk.read`, `decision.approve`, `decision.decline`, `decision.request_info`, `audit.read` |
| `dealer_staff` | `deal.create`, `deal.read`, `deal.update`, `deal.submit`, `consent.create`, `consent.read`, `risk.read` |
| `finance` | `deal.read`, `payment.initiate`, `subscription.activate`, `risk.read`, `audit.read` |
| `viewer` | `deal.read`, `risk.read` |
| `auditor` | `deal.read`, `consent.read`, `risk.read`, `audit.read` |

> Note the critical split encoded above: **`dealer_staff` has NO `credit.pull`,
> `decision.*`, or `payment.initiate`** — they can create and submit, but cannot make
> final credit decisions. `underwriter` holds all the decision-making permissions.

---

## 2. DDL (migration SQL)

```sql
-- =========================================================================
-- Enums
-- =========================================================================
CREATE TYPE org_status AS ENUM ('active','suspended','closed');
CREATE TYPE user_status AS ENUM ('active','invited','suspended','deactivated');
CREATE TYPE membership_status AS ENUM ('active','suspended','removed');
CREATE TYPE consent_method AS ENUM ('otp','other');
CREATE TYPE consent_status AS ENUM ('pending','granted','withdrawn','expired','failed');
CREATE TYPE deal_status AS ENUM (
  'draft','submitted','consent_pending','in_review','approved','declined',
  'info_requested','activated','active','completed','cancelled'
);
CREATE TYPE decision_type AS ENUM ('approve','decline','request_info');

-- =========================================================================
-- Tenancy & users
-- =========================================================================
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  status      org_status NOT NULL DEFAULT 'active',
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,   -- org-level risk defaults etc.
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          citext NOT NULL UNIQUE,
  full_name      text NOT NULL,
  phone          text,                              -- E.164, e.g. +2567XXXXXXXX
  password_hash  text NOT NULL,                     -- bcrypt/argon2 (or Auth provider id)
  status         user_status NOT NULL DEFAULT 'active',
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- Roles & permissions (system catalog — shared across orgs)
-- =========================================================================
CREATE TABLE roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,   -- 'org_admin', 'underwriter', 'dealer_staff', ...
  name        text NOT NULL,
  description text,
  is_system   boolean NOT NULL DEFAULT true,   -- orgs may clone into custom roles later
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,   -- 'credit.pull', 'decision.approve', ...
  name        text NOT NULL,
  category    text NOT NULL,          -- 'deal' | 'consent' | 'risk' | 'decision' | ...
  sensitive   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  role_id       uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- =========================================================================
-- Membership: user <-> org <-> role (the heart of multi-tenant RBAC)
-- =========================================================================
CREATE TABLE organization_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  status      membership_status NOT NULL DEFAULT 'active',
  invited_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)            -- one membership row per user per org
);

-- Role overrides at the org level (optional v1.1): let an org tweak what a
-- role may do without editing the shared catalog.
CREATE TABLE org_role_overrides (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id      uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted      boolean NOT NULL,       -- true = add, false = revoke
  UNIQUE (org_id, role_id, permission_id)
);

-- =========================================================================
-- Audit log — append-only, covers ALL sensitive actions
-- =========================================================================
CREATE TABLE audit_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,  -- keep row if user deleted
  action      text NOT NULL,          -- 'credit.pull', 'decision.approve', ...
  entity_type text NOT NULL,          -- 'deal' | 'consent' | 'subscription' | ...
  entity_id   uuid NOT NULL,
  before      jsonb,                  -- snapshot for decisions (term/deposit/monthly)
  after       jsonb,
  meta        jsonb,                  -- provider refs, score ids, otp ref, reason, ...
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_org_created ON audit_logs (org_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_members_user ON organization_members (user_id);
CREATE INDEX idx_members_org ON organization_members (org_id);
```

### 2.1 Consent (append-only slice — ties the "must-have before any score" rule to data)

```sql
CREATE TABLE consents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  deal_id         uuid NOT NULL,                      -- FK to deals.deal_id
  subscriber_id   uuid NOT NULL,                      -- FK to subscribers.id
  method          consent_method NOT NULL DEFAULT 'otp',
  phone           text NOT NULL,                      -- phone that received the OTP
  nin             text NOT NULL,                      -- masked on read for non-auditors
  status          consent_status NOT NULL DEFAULT 'pending',
  otp_reference   text,                               -- provider OTP id / hash
  initiated_by    uuid NOT NULL REFERENCES users(id),
  granted_at      timestamptz,                        -- set when OTP verified
  withdrawn_at    timestamptz,
  withdrawn_by    uuid REFERENCES users(id),
  withdraw_reason text,
  ip_address      inet NOT NULL,
  user_agent      text,
  immutable_hash  text NOT NULL,                      -- sha256 over canonical fields
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Enforce "one active consent per deal" at the DB layer:
CREATE UNIQUE INDEX uq_consent_active_per_deal
  ON consents (deal_id) WHERE status IN ('pending','granted');
```

**Invariant enforced in the API layer:** `POST /credit/pull` **must** first verify a
`consents` row with `status = 'granted'` and `withdrawn_at IS NULL` for that deal,
otherwise it returns `409 CONSENT_REQUIRED`. The score is never requested without it.

---

## 3. How to resolve permissions (SQL)

```sql
-- Effective permissions for a user within one org, including role overrides:
SELECT p.code
FROM organization_members m
JOIN roles r            ON r.id = m.role_id
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p     ON p.id = rp.permission_id
LEFT JOIN org_role_overrides o
       ON o.org_id = m.org_id AND o.role_id = r.id AND o.permission_id = p.id
WHERE m.org_id = :org_id
  AND m.user_id = :user_id
  AND m.status = 'active'
  AND COALESCE(o.granted, true) = true;   -- overrides can revoke ('granted' = false)
```

In code this becomes a helper:

```ts
// lib/authz.ts
export async function can(
  user: SessionUser,
  orgId: string,
  permission: string,
): Promise<boolean>
```

which is called in every route handler (see `02-api-endpoints.md`) **and** in the UI to
hide/disable buttons (see `03-nextjs-frontend-prompt.md`).

---

## 4. Audit wiring for sensitive actions

| Action | What gets written to `audit_logs` |
|---|---|
| `consent.create` (OTP sent) | `action=consent.otp_sent`, `entity=consent`, `meta={otp_reference, phone}` |
| `consent.granted` | `action=consent.granted`, `meta={method:'otp', ip, initiated_by}` |
| `consent.withdraw` | `action=consent.withdrawn`, `meta={withdrawn_by, reason}` |
| `credit.pull` | `action=credit.pull`, `entity=deal`, `after={gnuGrid_ref, internal_ref}`, `meta={provider, ip}` |
| `decision.approve` | `action=decision.approve`, `entity=deal`, `before={term,deposit,monthly}`, `after={...}` |
| `decision.decline` | `action=decision.decline`, `meta={reason}` |
| `decision.request_info` | `action=decision.request_info`, `meta={reason, requested_at}` |
| `payment.initiate` | `action=payment.initiate`, `meta={provider, channel, rtp_ref}` |
| `subscription.activate` | `action=subscription.activate`, `meta={schedule_id}` |
| `org.users.manage` | `action=org.member.role_changed`, `before={role}`, `after={role}` |
| `org.risk_rules.manage` | `action=org.risk_rules.updated`, `before`, `after` |

**Rule:** any route handler touching a `sensitive=true` permission MUST emit an
`audit_logs` row in the same DB transaction as the mutation.

---

## 5. Migration / rollback notes

- Additive only: new columns via `ALTER TABLE ... ADD COLUMN`, new tables via `CREATE`.
- `ON DELETE RESTRICT` on `audit_logs.org_id` and `consents` FKs means you can never
  hard-delete an org or deal that has history — soft-delete (`status`) instead.
- `immutable_hash` on `consents` is computed by the API and verified on read; if it
  doesn't match, the consent is flagged `tampered` and treated as invalid for pulls.
