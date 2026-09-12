"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";

type Risk = {
  combinedScore: number;
  tier: string;
  gnuGridScore: number | null;
  internalAssetScore: number | null;
  explanation: string[];
  recommended: { deposit: number; termMonths: number; monthlyAmount: number; financed: number };
  providerRef?: string | null;
};

type Consent = {
  id: string;
  status: string;
  phone: string;
  grantedAt: string | null;
  withdrawnAt: string | null;
  withdrawReason: string | null;
} | null;

type DealData = {
  id: string;
  status: string;
  vehicle: { plate: string; make: string; model: string; year: number; value: number };
  subscriber: { nin: string; phone: string; name: string };
  proposed: { desiredAmount: number };
  decision: { type: string; at: string; structure?: any; reason?: string } | null;
  declinedReason: string | null;
  consent: Consent;
  latestRisk: Risk | null;
};

type Props = {
  orgId: string;
  dealId: string;
  permissions: string[];
  initial: DealData;
};

const TABS = ["Overview", "Consent", "Risk", "Decision"] as const;
type Tab = (typeof TABS)[number];

export function DealDetail({ orgId, dealId, permissions, initial }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [deal, setDeal] = useState<DealData>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const has = (p: string) => permissions.includes(p);
  const canPull = has("credit.pull") && deal.consent?.status === "granted";

  async function run(action: string, path: string, init?: RequestInit) {
    setBusy(action);
    setMsg(null);
    try {
      const res = await apiFetch(path, init);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg(data?.error?.message ?? `Action failed (${res.status})`);
        return null;
      }
      return data;
    } finally {
      setBusy(null);
    }
  }

  async function requestConsent() {
    const data = await run("consent.request", `/api/orgs/${orgId}/deals/${dealId}/consent/request`, { method: "POST" });
    if (data) {
      setMsg(`OTP sent to ${deal.subscriber.phone}. Demo code: ${data.demoOtp}`);
      setDeal((d) => ({ ...d, consent: { id: data.consentId, status: "pending", phone: d.subscriber.phone, grantedAt: null, withdrawnAt: null, withdrawReason: null } }));
    }
  }

  async function verifyConsent(otp: string) {
    const data = await run("consent.verify", `/api/orgs/${orgId}/deals/${dealId}/consent/verify`, {
      method: "POST",
      body: JSON.stringify({ otp }),
    });
    if (data) {
      setMsg("Consent granted ✓");
      setDeal((d) => ({ ...d, consent: { ...d.consent!, status: "granted", grantedAt: new Date().toISOString() } }));
    }
  }

  async function withdrawConsent(reason: string) {
    const data = await run("consent.withdraw", `/api/orgs/${orgId}/deals/${dealId}/consent/withdraw`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    if (data) {
      setMsg("Consent withdrawn — future pulls blocked.");
      setDeal((d) => ({ ...d, consent: { ...d.consent!, status: "withdrawn", withdrawnAt: new Date().toISOString(), withdrawReason: reason } }));
    }
  }

  async function pullCredit() {
    const data = await run("credit.pull", `/api/orgs/${orgId}/deals/${dealId}/risk/pull`, { method: "POST" });
    if (data) {
      setMsg(`Risk assessment complete — tier ${data.risk.tier}`);
      setDeal((d) => ({ ...d, latestRisk: data.risk }));
    }
  }

  async function decide(type: "approve" | "decline" | "request_info", reason?: string) {
    const data = await run(`decision.${type}`, `/api/orgs/${orgId}/deals/${dealId}/decision`, {
      method: "POST",
      body: JSON.stringify({ type, reason }),
    });
    if (data) {
      setMsg(`Decision recorded: ${type.replace("_", " ")}`);
      setDeal((d) => ({ ...d, status: data.deal.status }));
      router.refresh();
    }
  }

  const { vehicle, subscriber } = deal;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {subscriber.name} · {vehicle.make} {vehicle.model}
          </h1>
          <p className="text-sm text-slate-500">
            {vehicle.plate} ({vehicle.year}) · NIN {subscriber.nin} · {subscriber.phone}
          </p>
        </div>
        <StatusPill status={deal.status} />
      </div>

      <div className="mb-6 flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              tab === t ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {msg && (
        <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          {msg}
        </div>
      )}

      {tab === "Overview" && <Overview deal={deal} />}

      {tab === "Consent" && (
        <ConsentTab
          deal={deal}
          has={has}
          busy={busy}
          onRequest={requestConsent}
          onVerify={verifyConsent}
          onWithdraw={withdrawConsent}
        />
      )}

      {tab === "Risk" && (
        <RiskTab deal={deal} has={has} canPull={canPull} busy={busy} onPull={pullCredit} />
      )}

      {tab === "Decision" && (
        <DecisionTab deal={deal} has={has} busy={busy} onDecide={decide} />
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-slate-50 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

function Overview({ deal }: { deal: DealData }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card title="Vehicle">
        <Row label="Plate" value={deal.vehicle.plate} />
        <Row label="Make / model" value={`${deal.vehicle.make} ${deal.vehicle.model}`} />
        <Row label="Year" value={deal.vehicle.year} />
        <Row label="Market value" value={`UGX ${deal.vehicle.value.toLocaleString()}`} />
      </Card>
      <Card title="Subscriber">
        <Row label="Name" value={deal.subscriber.name} />
        <Row label="NIN" value={deal.subscriber.nin} />
        <Row label="Phone" value={deal.subscriber.phone} />
        <Row label="Desired finance" value={`UGX ${(deal.proposed?.desiredAmount ?? 0).toLocaleString()}`} />
      </Card>
      <Card title="Decision">
        {deal.decision ? (
          <>
            <Row label="Outcome" value={deal.decision.type.replace("_", " ")} />
            <Row label="At" value={new Date(deal.decision.at).toLocaleString()} />
            {deal.declinedReason && <Row label="Reason" value={deal.declinedReason} />}
          </>
        ) : (
          <p className="text-sm text-slate-400">No decision yet.</p>
        )}
      </Card>
    </div>
  );
}

function ConsentTab({
  deal,
  has,
  busy,
  onRequest,
  onVerify,
  onWithdraw,
}: {
  deal: DealData;
  has: (p: string) => boolean;
  busy: string | null;
  onRequest: () => void;
  onVerify: (otp: string) => void;
  onWithdraw: (reason: string) => void;
}) {
  const [otp, setOtp] = useState("");
  const [reason, setReason] = useState("");
  const c = deal.consent;

  return (
    <Card title="Subscriber consent (OTP)">
      {!c || c.status === "pending" ? (
        <div>
          <p className="mb-4 text-sm text-slate-500">
            {c ? "OTP sent — ask the subscriber for the code, then verify." : "No consent captured yet."}
          </p>
          {!c && has("consent.create") && (
            <button onClick={onRequest} disabled={busy !== null}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {busy === "consent.request" ? "Sending…" : "Send OTP"}
            </button>
          )}
          {c && has("consent.create") && (
            <div className="flex gap-2">
              <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter OTP"
                className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none" />
              <button onClick={() => onVerify(otp)} disabled={!otp || busy !== null}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                Verify
              </button>
            </div>
          )}
          {!has("consent.create") && (
            <p className="text-sm text-slate-400">You don&apos;t have permission to capture consent.</p>
          )}
        </div>
      ) : c.status === "granted" ? (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">Granted</span>
            <span className="text-xs text-slate-400">via OTP to {c.phone} at {c.grantedAt ? new Date(c.grantedAt).toLocaleString() : "—"}</span>
          </div>
          {has("consent.withdraw") && (
            <div className="flex gap-2">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Withdrawal reason"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none" />
              <button onClick={() => onWithdraw(reason)} disabled={!reason || busy !== null}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">
                Withdraw consent
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">Withdrawn</span>
          <span className="text-xs text-slate-400">{c.withdrawReason}</span>
        </div>
      )}
    </Card>
  );
}

function RiskTab({
  deal,
  has,
  canPull,
  busy,
  onPull,
}: {
  deal: DealData;
  has: (p: string) => boolean;
  canPull: boolean;
  busy: string | null;
  onPull: () => void;
}) {
  const r = deal.latestRisk;
  return (
    <Card title="Risk assessment">
      {!r ? (
        <div>
          <p className="mb-4 text-sm text-slate-500">No risk assessment yet.</p>
          {has("credit.pull") ? (
            <>
              {!canPull && deal.consent?.status !== "granted" && (
                <p className="mb-3 text-sm text-amber-700">Consent must be granted before a credit pull.</p>
              )}
              <button onClick={onPull} disabled={!canPull || busy !== null}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {busy === "credit.pull" ? "Pulling…" : "Run credit pull"}
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-400">You don&apos;t have permission to pull credit.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Combined score" value={r.combinedScore} />
          <Stat label="Tier" value={r.tier} />
          <Stat label="gnuGrid" value={r.gnuGridScore ?? "—"} />
          <div className="sm:col-span-3 rounded-lg bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended structure</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <Row label="Deposit" value={`${(r.recommended.deposit * 100).toFixed(0)}%`} />
              <Row label="Term" value={`${r.recommended.termMonths} mo`} />
              <Row label="Monthly" value={`UGX ${r.recommended.monthlyAmount.toLocaleString()}`} />
            </div>
          </div>
          {r.explanation.length > 0 && (
            <ul className="sm:col-span-3 list-disc pl-5 text-sm text-slate-500">
              {r.explanation.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 p-4 text-center">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function DecisionTab({
  deal,
  has,
  busy,
  onDecide,
}: {
  deal: DealData;
  has: (p: string) => boolean;
  busy: string | null;
  onDecide: (type: "approve" | "decline" | "request_info", reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const decided = ["approved", "declined", "activated", "active"].includes(deal.status);

  if (decided) {
    return (
      <Card title="Decision">
        <Row label="Status" value={deal.status.replace("_", " ")} />
        {deal.declinedReason && <Row label="Reason" value={deal.declinedReason} />}
      </Card>
    );
  }

  const canApprove = has("decision.approve");
  const canDecline = has("decision.decline");
  const canRequest = has("decision.request_info");

  if (!canApprove && !canDecline && !canRequest) {
    return (
      <Card title="Decision">
        <p className="text-sm text-slate-400">
          You don&apos;t have permission to make credit decisions. Dealer staff can create and submit deals but cannot approve or decline.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Decision">
      <p className="mb-4 text-sm text-slate-500">This deal is <span className="font-medium">{deal.status}</span>. Choose an outcome:</p>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason / notes (optional for approve)"
        className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none" />
      <div className="flex gap-3">
        {canApprove && (
          <button onClick={() => onDecide("approve", reason)} disabled={busy !== null}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            Approve
          </button>
        )}
        {canDecline && (
          <button onClick={() => onDecide("decline", reason)} disabled={busy !== null}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            Decline
          </button>
        )}
        {canRequest && (
          <button onClick={() => onDecide("request_info", reason)} disabled={busy !== null}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">
            Request more info
          </button>
        )}
      </div>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600",
    submitted: "bg-blue-100 text-blue-700",
    consent_pending: "bg-amber-100 text-amber-700",
    in_review: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    declined: "bg-red-100 text-red-700",
    info_requested: "bg-purple-100 text-purple-700",
    activated: "bg-emerald-100 text-emerald-700",
    active: "bg-emerald-100 text-emerald-700",
    completed: "bg-slate-100 text-slate-600",
    cancelled: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${colors[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}
