import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Zero-dependency data layer using Node's built-in SQLite (node:sqlite).
 * Chosen because this environment blocks downloads of the Prisma engine
 * binaries; node:sqlite ships with Node 22 and needs nothing external.
 *
 * A Prisma schema reference is kept at prisma/schema.prisma for documentation
 * and as the blueprint for a Postgres migration in production.
 */

const DB_PATH = process.env.DATABASE_URL?.replace(/^file:/, "") || "prisma/dev.db";
const resolved = path.resolve(process.cwd(), DB_PATH);
mkdirSync(path.dirname(resolved), { recursive: true });

const db = new DatabaseSync(resolved);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

type SQLInputValue = null | number | bigint | string | Uint8Array;

export function newId(): string {
  return randomUUID();
}

export function all<T = Record<string, unknown>>(sql: string, ...params: SQLInputValue[]): T[] {
  const stmt = db.prepare(sql);
  return stmt.all(...params) as unknown as T[];
}

export function get<T = Record<string, unknown>>(sql: string, ...params: SQLInputValue[]): T | undefined {
  const stmt = db.prepare(sql);
  return stmt.get(...params) as unknown as T | undefined;
}

export function run(sql: string, ...params: SQLInputValue[]): { changes: number | bigint; lastInsertRowid: number | bigint } {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

export function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Schema (migrated idempotently on first use)
// ---------------------------------------------------------------------------
export function initSchema() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active', settings TEXT NOT NULL DEFAULT '{}',
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, fullName TEXT NOT NULL,
    phone TEXT, passwordHash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
    lastLoginAt TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    description TEXT, isSystem INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    category TEXT NOT NULL, sensitive INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS role_permissions (
    roleId TEXT NOT NULL, permissionId TEXT NOT NULL,
    PRIMARY KEY (roleId, permissionId)
  );
  CREATE TABLE IF NOT EXISTS organization_members (
    id TEXT PRIMARY KEY, orgId TEXT NOT NULL, userId TEXT NOT NULL, roleId TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', invitedBy TEXT,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
    UNIQUE (orgId, userId)
  );
  CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY, orgId TEXT NOT NULL, createdBy TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', vehicleJson TEXT NOT NULL, subJson TEXT NOT NULL,
    proposed TEXT NOT NULL DEFAULT '{}', decision TEXT, declinedReason TEXT,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_deals_org_status ON deals (orgId, status);
  CREATE TABLE IF NOT EXISTS consents (
    id TEXT PRIMARY KEY, orgId TEXT NOT NULL, dealId TEXT NOT NULL, subscriberId TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'otp', phone TEXT NOT NULL, nin TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', otpReference TEXT, otpCodeHash TEXT,
    initiatedBy TEXT NOT NULL, grantedAt TEXT, withdrawnAt TEXT, withdrawnBy TEXT,
    withdrawReason TEXT, ipAddress TEXT NOT NULL, userAgent TEXT, immutableHash TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_consents_deal ON consents (dealId);
  CREATE TABLE IF NOT EXISTS risk_assessments (
    id TEXT PRIMARY KEY, dealId TEXT NOT NULL, gnuGridScore INTEGER, internalAssetScore INTEGER,
    combinedScore INTEGER NOT NULL, tier TEXT NOT NULL, explanation TEXT NOT NULL DEFAULT '[]',
    recommended TEXT NOT NULL DEFAULT '{}', providerRef TEXT, createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_risk_deal ON risk_assessments (dealId);
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY, dealId TEXT NOT NULL, channel TEXT NOT NULL, amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', providerRef TEXT, createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY, dealId TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'active',
    schedule TEXT NOT NULL DEFAULT '[]', activatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS risk_rules (
    id TEXT PRIMARY KEY, orgId TEXT NOT NULL UNIQUE, config TEXT NOT NULL DEFAULT '{}',
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY, orgId TEXT NOT NULL, userId TEXT, action TEXT NOT NULL,
    entityType TEXT NOT NULL, entityId TEXT NOT NULL, before TEXT, after TEXT, meta TEXT,
    ipAddress TEXT, userAgent TEXT, createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs (orgId, createdAt);
  `);
}

initSchema();
