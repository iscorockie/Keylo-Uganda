import { get, run, all, newId, now } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

// ---------------------------------------------------------------------------
// Permission catalog (matches docs/01 + docs/03)
// ---------------------------------------------------------------------------
const PERMISSIONS: { code: string; name: string; category: string; sensitive: number }[] = [
  { code: "org.users.manage", name: "Manage org members", category: "org", sensitive: 1 },
  { code: "org.risk_rules.manage", name: "Manage risk rules", category: "org", sensitive: 1 },
  { code: "deal.create", name: "Create deals", category: "deal", sensitive: 0 },
  { code: "deal.read", name: "Read deals", category: "deal", sensitive: 0 },
  { code: "deal.update", name: "Update deals", category: "deal", sensitive: 0 },
  { code: "deal.submit", name: "Submit deals", category: "deal", sensitive: 0 },
  { code: "consent.create", name: "Capture consent", category: "consent", sensitive: 1 },
  { code: "consent.read", name: "Read consent", category: "consent", sensitive: 0 },
  { code: "consent.withdraw", name: "Withdraw consent", category: "consent", sensitive: 1 },
  { code: "credit.pull", name: "Pull credit", category: "risk", sensitive: 1 },
  { code: "risk.read", name: "Read risk", category: "risk", sensitive: 0 },
  { code: "decision.approve", name: "Approve deals", category: "decision", sensitive: 1 },
  { code: "decision.decline", name: "Decline deals", category: "decision", sensitive: 1 },
  { code: "decision.request_info", name: "Request info", category: "decision", sensitive: 1 },
  { code: "payment.initiate", name: "Initiate payments", category: "payment", sensitive: 1 },
  { code: "subscription.activate", name: "Activate subscriptions", category: "subscription", sensitive: 1 },
  { code: "audit.read", name: "Read audit log", category: "audit", sensitive: 0 },
];

const ALL = PERMISSIONS.map((p) => p.code);
const ROLES: { key: string; name: string; description: string; perms: string[] }[] = [
  { key: "org_admin", name: "Organization Admin", description: "Full control", perms: ALL },
  {
    key: "underwriter", name: "Underwriter", description: "Makes final credit decisions",
    perms: ["deal.read", "consent.read", "consent.withdraw", "credit.pull", "risk.read", "decision.approve", "decision.decline", "decision.request_info", "audit.read"],
  },
  {
    key: "dealer_staff", name: "Dealer Staff", description: "Creates and submits deals",
    perms: ["deal.create", "deal.read", "deal.update", "deal.submit", "consent.create", "consent.read", "risk.read"],
  },
  {
    key: "finance", name: "Finance", description: "Payments and activation",
    perms: ["deal.read", "payment.initiate", "subscription.activate", "risk.read", "audit.read"],
  },
  { key: "viewer", name: "Viewer", description: "Read-only", perms: ["deal.read", "risk.read"] },
  { key: "auditor", name: "Auditor", description: "Read-only + audit", perms: ["deal.read", "consent.read", "risk.read", "audit.read"] },
];

const DEMO_USERS: { email: string; fullName: string; role: string }[] = [
  { email: "admin@keylo.ug", fullName: "Aisha Admin", role: "org_admin" },
  { email: "underwriter@keylo.ug", fullName: "Daniel Underwriter", role: "underwriter" },
  { email: "dealer@keylo.ug", fullName: "Grace Dealer", role: "dealer_staff" },
  { email: "finance@keylo.ug", fullName: "Brian Finance", role: "finance" },
  { email: "viewer@keylo.ug", fullName: "Mary Viewer", role: "viewer" },
  { email: "auditor@keylo.ug", fullName: "Sam Auditor", role: "auditor" },
];

function upsertOrg(name: string, slug: string): string {
  const existing = get<{ id: string }>("SELECT id FROM organizations WHERE slug = ?", slug);
  if (existing) return existing.id;
  const id = newId();
  run(
    "INSERT INTO organizations (id, name, slug, status, settings, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)",
    id, name, slug, "active", "{}", now(), now(),
  );
  return id;
}

function upsertRole(key: string, name: string, description: string, perms: string[]): string {
  const existing = get<{ id: string }>("SELECT id FROM roles WHERE key = ?", key);
  const id = existing?.id ?? newId();
  if (existing) {
    run("UPDATE roles SET name = ?, description = ? WHERE id = ?", name, description, id);
  } else {
    run("INSERT INTO roles (id, key, name, description, isSystem, createdAt) VALUES (?,?,?,?,1,?)", id, key, name, description, now());
  }
  run("DELETE FROM role_permissions WHERE roleId = ?", id);
  for (const code of perms) {
    const pid = get<{ id: string }>("SELECT id FROM permissions WHERE code = ?", code)!.id;
    run("INSERT INTO role_permissions (roleId, permissionId) VALUES (?,?)", id, pid);
  }
  return id;
}

async function main() {
  console.log("Seeding Keylo Uganda…");

  // Permissions
  for (const p of PERMISSIONS) {
    const existing = get<{ id: string }>("SELECT id FROM permissions WHERE code = ?", p.code);
    if (existing) {
      run("UPDATE permissions SET name = ?, category = ?, sensitive = ? WHERE id = ?", p.name, p.category, p.sensitive, existing.id);
    } else {
      run("INSERT INTO permissions (id, code, name, category, sensitive, createdAt) VALUES (?,?,?,?,?,?)", newId(), p.code, p.name, p.category, p.sensitive, now());
    }
  }
  console.log(`✓ ${PERMISSIONS.length} permissions`);

  // Roles
  for (const r of ROLES) upsertRole(r.key, r.name, r.description, r.perms);
  console.log(`✓ ${ROLES.length} roles`);

  // Org + risk rules
  const orgId = upsertOrg("Keylo Uganda (Demo)", "keylo-demo");
  const rule = get<{ id: string }>("SELECT id FROM risk_rules WHERE orgId = ?", orgId);
  const config = JSON.stringify({
    weights: { gnuGrid: 0.6, asset: 0.4 },
    tiers: [
      { tier: "A", min: 700, maxLtv: 0.75 },
      { tier: "B", min: 600, maxLtv: 0.6 },
      { tier: "C", min: 500, maxLtv: 0.5 },
      { tier: "D", min: 0, maxLtv: 0.4 },
    ],
  });
  if (rule) {
    run("UPDATE risk_rules SET config = ?, updatedAt = ? WHERE id = ?", config, now(), rule.id);
  } else {
    run("INSERT INTO risk_rules (id, orgId, config, createdAt, updatedAt) VALUES (?,?,?,?,?)", newId(), orgId, config, now(), now());
  }
  console.log("✓ 1 organization + risk rules");

  // Users + memberships
  // Demo password is shared for convenience; each is stored as a bcrypt hash
  // (cost factor from BCRYPT_ROUNDS, default 12). Re-hash on every seed so
  // existing dev databases pick up a stronger cost factor when it changes.
  const DEMO_PASSWORD = "demo1234";
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const u of DEMO_USERS) {
    let user = get<{ id: string }>("SELECT id FROM users WHERE email = ?", u.email);
    if (user) {
      run("UPDATE users SET fullName = ?, passwordHash = ?, updatedAt = ? WHERE id = ?", u.fullName, passwordHash, now(), user.id);
    } else {
      const uid = newId();
      run("INSERT INTO users (id, email, fullName, passwordHash, status, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)", uid, u.email, u.fullName, passwordHash, "active", now(), now());
      user = { id: uid };
    }
    const roleId = get<{ id: string }>("SELECT id FROM roles WHERE key = ?", u.role)!.id;
    const mem = get<{ id: string }>("SELECT id FROM organization_members WHERE orgId = ? AND userId = ?", orgId, user.id);
    if (mem) {
      run("UPDATE organization_members SET roleId = ?, updatedAt = ? WHERE id = ?", roleId, now(), mem.id);
    } else {
      run("INSERT INTO organization_members (id, orgId, userId, roleId, status, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)", newId(), orgId, user.id, roleId, "active", now(), now());
    }
  }
  console.log(`✓ ${DEMO_USERS.length} users`);

  console.log(`\nDone. Demo login (password '${DEMO_PASSWORD}' for all):`);
  for (const u of DEMO_USERS) console.log(`  ${u.email.padEnd(26)} → ${u.role}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
