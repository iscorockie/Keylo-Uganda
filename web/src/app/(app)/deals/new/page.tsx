import { redirect } from "next/navigation";
import { currentOrg } from "@/lib/org";
import { can } from "@/lib/authz";
import { NewDealForm } from "@/components/new-deal-form";

export const dynamic = "force-dynamic";

export default async function NewDealPage() {
  const ctx = await currentOrg();
  if (!ctx) redirect("/login");
  const { session, orgId } = ctx;
  if (!can(session, orgId, "deal.create")) redirect("/deals");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">New deal</h1>
      <NewDealForm orgId={orgId} />
    </div>
  );
}
