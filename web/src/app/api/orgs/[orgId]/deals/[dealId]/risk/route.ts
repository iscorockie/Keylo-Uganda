import { NextResponse } from "next/server";
import { get } from "@/lib/db";
import { requirePermission } from "@/lib/api";

export async function GET(req: Request, ctx: { params: Promise<{ orgId: string; dealId: string }> }) {
  const { orgId, dealId } = await ctx.params;
  const auth = await requirePermission(req, orgId, "risk.read");
  if ("error" in auth) return auth.error;

  const latest = get<{
    combinedScore: number; tier: string; gnuGridScore: number | null;
    internalAssetScore: number | null; explanation: string; recommended: string;
    providerRef: string | null; createdAt: string;
  }>("SELECT * FROM risk_assessments WHERE dealId = ? ORDER BY createdAt DESC", dealId);

  if (!latest) return NextResponse.json({ risk: null });

  return NextResponse.json({
    risk: {
      combinedScore: latest.combinedScore,
      tier: latest.tier,
      gnuGridScore: latest.gnuGridScore,
      internalAssetScore: latest.internalAssetScore,
      explanation: JSON.parse(latest.explanation),
      recommended: JSON.parse(latest.recommended),
      providerRef: latest.providerRef,
      createdAt: latest.createdAt,
    },
  });
}
