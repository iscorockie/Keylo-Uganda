import Link from "next/link";
import { currentOrg } from "@/lib/org";
import { can } from "@/lib/authz";
import { all } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await currentOrg();
  if (!ctx) return null;
  const { session, orgId } = ctx;

  const { status } = await searchParams;
  const deals = all<{ id: string; status: string; subJson: string; vehicleJson: string; createdAt: string }>(
    "SELECT * FROM deals WHERE orgId = ? " + (status ? "AND status = ? " : "") + "ORDER BY createdAt DESC",
    ...(status ? [orgId, status] : [orgId]),
  );
  const statuses = all<{ status: string; c: number }>(
    "SELECT status, COUNT(*) AS c FROM deals WHERE orgId = ? GROUP BY status", orgId,
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Deals</h1>
        {can(session, orgId, "deal.create") && (
          <Link href="/deals/new" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
            + New deal
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip href="/deals" active={!status} label="All" />
        {statuses.map((s) => (
          <FilterChip
            key={s.status}
            href={`/deals?status=${s.status}`}
            active={status === s.status}
            label={`${s.status.replace("_", " ")} (${s.c})`}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {deals.length === 0 ? (
          <p className="px-6 py-10 text-sm text-slate-400">No deals found.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {deals.map((d) => {
              const sub = JSON.parse(d.subJson);
              const veh = JSON.parse(d.vehicleJson);
              return (
                <li key={d.id}>
                  <Link href={`/deals/${d.id}`} className="flex items-center justify-between px-6 py-4 transition hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {sub.name} · {veh.make} {veh.model} ({veh.year})
                      </p>
                      <p className="text-xs text-slate-400">
                        {veh.plate} · NIN {sub.nin} · created {new Date(d.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge status={d.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active ? "bg-brand-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}
