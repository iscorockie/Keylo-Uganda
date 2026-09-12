import { getSession } from "@/lib/session";

/**
 * Server-side: resolve the org in scope. For v1 (single org per demo user
 * mostly), default to the first membership. Multi-org switcher can pass
 * ?org=<id> later.
 */
export async function currentOrg() {
  const session = await getSession();
  if (!session) return null;
  const m = session.memberships[0];
  return { session, orgId: m.orgId, membership: m };
}
