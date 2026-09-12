import Link from "next/link";
import { currentOrg } from "@/lib/org";
import { can } from "@/lib/authz";
import { all } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

type DealRow = { id: string; status: string; subJson: string; vehicleJson: string; createdAt: string };
type CountRow = { status: string; c: number };
type ActivityRow = { id: string; action: string; actor: string | null; createdAt: string };

export default async function DashboardPage() {
  const ctx = await currentOrg();
  if (!ctx) return null;
  const { session, orgId } = ctx;

  const byStatus = all<CountRow>("SELECT status, COUNT(*) AS c FROM deals WHERE orgId = ? GROUP BY status", orgId);
  const recentDeals = all<DealRow>("SELECT * FROM deals WHERE orgId = ? ORDER BY createdAt DESC LIMIT 6", orgId);
  const recentActivity = all<ActivityRow>(
    `SELECT a.id, a.action, a.createdAt, COALESCE(u.fullName, u.email, 'system') AS actor
     FROM audit_logs a LEFT JOIN users u ON u.id = a.userId
     WHERE a.orgId = ? ORDER BY a.createdAt DESC LIMIT 8`,
    orgId,
  );

  const counts: Record<string, number> = {};
  for (const g of byStatus) counts[g.status] = g.c;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const stats = [
    { label: "Total deals", value: total },
    { label: "Pending decision", value: counts["submitted"] ?? 0, highlight: can(session, orgId, "decision.approve") },
    { label: "In review", value: (counts["in_review"] ?? 0) + (counts["consent_pending"] ?? 0) },
    { label: "Approved", value: counts["approved"] ?? 0 },
    { label: "Active", value: counts["active"] ?? 0 },
    { label: "Declined", value: counts["declined"] ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        {can(session, orgId, "deal.create") && (
          <Link
            href="/deals/new"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            + New deal
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border p-4 ${
              s.highlight ? "border-brand-200 bg-brand-50" : "border-slate-200 bg-white"
            }`}
          >
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Recent deals</h2>
            <Link href="/deals" className="text-xs font-medium text-brand-700 hover:underline">
              View all
            </Link>
          </header>
          <ul className="divide-y divide-slate-100">
            {recentDeals.length === 0 && <li className="px-5 py-6 text-sm text-slate-400">No deals yet.</li>}
            {recentDeals.map((d) => {
              const sub = JSON.parse(d.subJson);
              const veh = JSON.parse(d.vehicleJson);
              return (
                <li key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <Link href={`/deals/${d.id}`} className="text-sm font-medium text-slate-800 hover:text-brand-700">
                      {sub.name} · {veh.make} {veh.model}
                    </Link>
                    <p className="text-xs text-slate-400">{veh.plate}</p>
                  </div>
                  <StatusBadge status={d.status} />
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Recent activity</h2>
          </header>
          <ul className="divide-y divide-slate-100">
            {recentActivity.length === 0 && <li className="px-5 py-6 text-sm text-slate-400">No activity yet.</li>}
            {recentActivity.map((a) => (
              <li key={a.id} className="px-5 py-3">
                <p className="text-sm text-slate-700">
                  <span className="font-medium">{a.action}</span>
                </p>
                <p className="text-xs text-slate-400">
                  {a.actor} · {new Date(a.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}


