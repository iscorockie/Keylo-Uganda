import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-brand-700">
            Keylo<span className="text-amber-500">·</span>Uganda
          </h1>
          <p className="mt-2 text-sm text-slate-500">Vehicle financing, consent-first.</p>
        </div>
        <LoginForm />
        <DemoCreds />
      </div>
    </main>
  );
}

function DemoCreds() {
  const creds = [
    ["dealer@keylo.ug", "Dealer staff"],
    ["underwriter@keylo.ug", "Underwriter"],
    ["finance@keylo.ug", "Finance"],
    ["admin@keylo.ug", "Org admin"],
    ["auditor@keylo.ug", "Auditor"],
    ["viewer@keylo.ug", "Viewer"],
  ];
  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
      <p className="mb-2 font-semibold text-slate-600">Demo accounts — password: demo1234</p>
      <ul className="grid grid-cols-2 gap-1">
        {creds.map(([email, role]) => (
          <li key={email} className="truncate">
            <span className="font-mono">{email}</span>
            <span className="text-slate-400"> · {role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
