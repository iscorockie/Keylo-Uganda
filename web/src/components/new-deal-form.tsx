"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";

export function NewDealForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    plate: "",
    make: "",
    model: "",
    year: new Date().getFullYear(),
    value: "",
    nin: "",
    phone: "",
    name: "",
    desiredAmount: "",
  });

  function update(key: keyof typeof form, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      vehicle: {
        plate: form.plate,
        make: form.make,
        model: form.model,
        year: Number(form.year),
        value: Number(form.value),
      },
      subscriber: { nin: form.nin, phone: form.phone, name: form.name },
      proposed: form.desiredAmount ? { desiredAmount: Number(form.desiredAmount) } : undefined,
    };

    const res = await apiFetch(`/api/orgs/${orgId}/deals`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setSubmitting(false);

    if (res.ok) {
      const data = await res.json();
      router.push(`/deals/${data.deal.id}`);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error?.message ?? "Failed to create deal");
    }
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";
  const label = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Vehicle details</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Plate number">
            <input className={input} value={form.plate} onChange={(e) => update("plate", e.target.value)} required />
          </Field>
          <Field label="Make">
            <input className={input} value={form.make} onChange={(e) => update("make", e.target.value)} required />
          </Field>
          <Field label="Model">
            <input className={input} value={form.model} onChange={(e) => update("model", e.target.value)} required />
          </Field>
          <Field label="Year">
            <input type="number" className={input} value={form.year} onChange={(e) => update("year", Number(e.target.value))} required />
          </Field>
          <Field label="Market value (UGX)">
            <input type="number" className={input} value={form.value} onChange={(e) => update("value", e.target.value)} required />
          </Field>
          <Field label="Desired finance (UGX, optional)">
            <input type="number" className={input} value={form.desiredAmount} onChange={(e) => update("desiredAmount", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Subscriber details</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full name">
            <input className={input} value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </Field>
          <Field label="NIN">
            <input className={input} value={form.nin} onChange={(e) => update("nin", e.target.value)} required />
          </Field>
          <Field label="Phone (for OTP consent)">
            <input className={input} value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+2567XXXXXXXX" required />
          </Field>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/deals")}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create deal"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}
