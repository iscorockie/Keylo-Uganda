import type { SessionUser } from "@/lib/session";

/** Membership for the org currently in scope. */
export function membershipFor(session: SessionUser, orgId: string) {
  return session.memberships.find((m) => m.orgId === orgId) ?? null;
}

/** Effective permission set for a user within an org. */
export function permissionsFor(session: SessionUser, orgId: string): string[] {
  return membershipFor(session, orgId)?.permissions ?? [];
}

/** Central authorization check: can(user, orgId, "credit.pull") */
export function can(session: SessionUser, orgId: string, permission: string): boolean {
  return permissionsFor(session, orgId).includes(permission);
}
