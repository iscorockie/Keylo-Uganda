export function StatusBadge({ status }: { status: string }) {
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
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}
