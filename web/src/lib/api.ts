import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { can } from "@/lib/authz";

export function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function ipOf(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * Resolve session + enforce org membership + a permission.
 * Returns `{ session, orgId }` on success or a NextResponse error on failure.
 */
export async function requirePermission(req: Request, orgId: string, permission: string) {
  const session = await getSession();
  if (!session) return { error: jsonError("UNAUTHENTICATED", "Not signed in", 401) };

  const membership = session.memberships.find((m) => m.orgId === orgId);
  if (!membership) return { error: jsonError("NOT_FOUND", "Organization not found", 404) };
  if (!can(session, orgId, permission)) {
    return { error: jsonError("FORBIDDEN", `Missing permission: ${permission}`, 403) };
  }
  return { session, orgId };
}
