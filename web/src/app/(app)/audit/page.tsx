import { redirect } from "next/navigation";
import { currentOrg } from "@/lib/org";
import { can } from "@/lib/authz";
import { all } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const ctx = await currentOrg();
  if (!ctx) redirect("/login");
  const { session, orgId } = ctx;
  if (!can(session, orgId, "audit.read")) redirect("/dashboard");

  const logs = all<{ id: string; action: string; entityType: string; entityId: string; actor: string | null; ipAddress: string | null; createdAt: string }>(
    `SELECT a.id, a.action, a.entityType, a.entityId, a.ipAddress, a.createdAt, COALESCE(u.fullName, u.email, 'system') AS actor
     FROM audit_logs a LEFT JOIN users u ON u.id = a.userId
     WHERE a.orgId = ? ORDER BY a.createdAt DESC LIMIT 200`,
    orgId,
  );

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Audit log</h1>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {logs.length === 0 ? (
          <p className="px-6 py-10 text-sm text-slate-400">No audit events yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{l.actor}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">{l.action}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {l.entityType}:{l.entityId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{l.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
