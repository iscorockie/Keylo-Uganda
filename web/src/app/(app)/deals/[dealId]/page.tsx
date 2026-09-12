import { notFound, redirect } from "next/navigation";
import { currentOrg } from "@/lib/org";
import { can, permissionsFor } from "@/lib/authz";
import { all, get } from "@/lib/db";
import { DealDetail } from "@/components/deal-detail";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({ params }: { params: Promise<{ dealId: string }> }) {
  const ctx = await currentOrg();
  if (!ctx) redirect("/login");
  const { session, orgId } = ctx;
  if (!can(session, orgId, "deal.read")) redirect("/deals");

  const { dealId } = await params;

  const deal = get<{
    id: string; status: string; vehicleJson: string; subJson: string;
    proposed: string; decision: string | null; declinedReason: string | null;
  }>("SELECT * FROM deals WHERE id = ? AND orgId = ?", dealId, orgId);
  if (!deal) notFound();

  const consents = all<{ id: string; status: string; phone: string; grantedAt: string | null; withdrawnAt: string | null; withdrawReason: string | null }>(
    "SELECT * FROM consents WHERE dealId = ? ORDER BY createdAt DESC", deal.id,
  );
  const risk = all<{ combinedScore: number; tier: string; gnuGridScore: number | null; internalAssetScore: number | null; explanation: string; recommended: string; providerRef: string | null }>(
    "SELECT * FROM risk_assessments WHERE dealId = ? ORDER BY createdAt DESC", deal.id,
  );

  return (
    <DealDetail
      orgId={orgId}
      dealId={deal.id}
      permissions={permissionsFor(session, orgId)}
      initial={{
        id: deal.id,
        status: deal.status,
        vehicle: JSON.parse(deal.vehicleJson),
        subscriber: JSON.parse(deal.subJson),
        proposed: JSON.parse(deal.proposed),
        decision: deal.decision ? JSON.parse(deal.decision) : null,
        declinedReason: deal.declinedReason,
        consent: consents[0]
          ? {
              id: consents[0].id,
              status: consents[0].status,
              phone: consents[0].phone,
              grantedAt: consents[0].grantedAt,
              withdrawnAt: consents[0].withdrawnAt,
              withdrawReason: consents[0].withdrawReason,
            }
          : null,
        latestRisk: risk[0]
          ? {
              combinedScore: risk[0].combinedScore,
              tier: risk[0].tier,
              gnuGridScore: risk[0].gnuGridScore,
              internalAssetScore: risk[0].internalAssetScore,
              explanation: JSON.parse(risk[0].explanation),
              recommended: JSON.parse(risk[0].recommended),
              providerRef: risk[0].providerRef,
            }
          : null,
      }}
    />
  );
}
