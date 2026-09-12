"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/session";

type Props = {
  session: SessionUser;
  org: SessionUser["memberships"][number];
  children: React.ReactNode;
};

const NAV = [
  { href: "/dashboard", label: "Dashboard", perm: null },
  { href: "/deals", label: "Deals", perm: "deal.read" },
  { href: "/audit", label: "Audit log", perm: "audit.read" },
];

const ROLE_LABEL: Record<string, string> = {
  org_admin: "Org admin",
  underwriter: "Underwriter",
  dealer_staff: "Dealer staff",
  finance: "Finance",
  viewer: "Viewer",
  auditor: "Auditor",
};

export function AppShell({ session, org, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleNav = NAV.filter((n) => n.perm === null || org.permissions.includes(n.perm));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-5">
          <Link href="/dashboard" className="text-xl font-extrabold tracking-tight text-brand-700">
            Keylo<span className="text-amber-500">·</span>Uganda
          </Link>
          <p className="mt-1 truncate text-xs text-slate-400">{org.orgName}</p>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleNav.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 px-4 py-4">
          <p className="text-sm font-semibold text-slate-800">{session.fullName}</p>
          <p className="text-xs text-slate-400">{ROLE_LABEL[org.role] ?? org.role}</p>
          <button
            onClick={logout}
            className="mt-3 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden px-8 py-8">{children}</main>
    </div>
  );
}
