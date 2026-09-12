import { run, newId, now } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

type AuditInput = {
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  meta?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
};

/** Writes an immutable audit entry for a sensitive action. */
export async function audit(session: SessionUser, orgId: string, input: AuditInput) {
  run(
    `INSERT INTO audit_logs (id, orgId, userId, action, entityType, entityId, before, after, meta, ipAddress, userAgent, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    orgId,
    session.userId,
    input.action,
    input.entityType,
    input.entityId,
    input.before != null ? JSON.stringify(input.before) : null,
    input.after != null ? JSON.stringify(input.after) : null,
    input.meta != null ? JSON.stringify(input.meta) : null,
    input.ip ?? null,
    input.userAgent ?? null,
    now(),
  );
}
