import { NextResponse } from "next/server";
import { all, get } from "@/lib/db";
import { requirePermission, jsonError } from "@/lib/api";

export async function GET(req: Request, ctx: { params: Promise<{ orgId: string; dealId: string }> }) {
  const { orgId, dealId } = await ctx.params;
  const auth = await requirePermission(req, orgId, "deal.read");
  if ("error" in auth) return auth.error;

  const deal = get<{
    id: string; status: string; vehicleJson: string; subJson: string;
    proposed: string; decision: string | null; declinedReason: string | null; createdAt: string;
  }>("SELECT * FROM deals WHERE id = ? AND orgId = ?", dealId, orgId);
  if (!deal) return jsonError("NOT_FOUND", "Deal not found", 404);

  const consents = all<{ id: string; status: string; phone: string; grantedAt: string | null; withdrawnAt: string | null; withdrawReason: string | null; method: string; createdAt: string }>(
    "SELECT * FROM consents WHERE dealId = ? ORDER BY createdAt DESC", deal.id,
  );
  const risk = all<{ id: string; combinedScore: number; tier: string; gnuGridScore: number | null; internalAssetScore: number | null; explanation: string; recommended: string; providerRef: string | null; createdAt: string }>(
    "SELECT * FROM risk_assessments WHERE dealId = ? ORDER BY createdAt DESC", deal.id,
  );
  const payments = all("SELECT * FROM payments WHERE dealId = ? ORDER BY createdAt DESC", deal.id);
  const subscription = get("SELECT * FROM subscriptions WHERE dealId = ?", deal.id);

  return NextResponse.json({
    deal: {
      id: deal.id,
      status: deal.status,
      vehicle: JSON.parse(deal.vehicleJson),
      subscriber: JSON.parse(deal.subJson),
      proposed: JSON.parse(deal.proposed),
      decision: deal.decision ? JSON.parse(deal.decision) : null,
      declinedReason: deal.declinedReason,
      consent: consents[0] ?? null,
      latestRisk: risk[0] ? { ...risk[0], explanation: JSON.parse(risk[0].explanation), recommended: JSON.parse(risk[0].recommended) } : null,
      payments,
      subscription,
      createdAt: deal.createdAt,
    },
  });
}
