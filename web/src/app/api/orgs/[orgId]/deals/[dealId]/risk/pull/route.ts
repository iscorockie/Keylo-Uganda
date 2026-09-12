import { NextResponse } from "next/server";
import { get, run, newId, now } from "@/lib/db";
import { requirePermission, jsonError, ipOf } from "@/lib/api";
import { audit } from "@/lib/audit";
import { gnuGridMobileScore } from "@/lib/providers";
import { computeRisk, parseRules } from "@/lib/risk";

export async function POST(req: Request, ctx: { params: Promise<{ orgId: string; dealId: string }> }) {
  const { orgId, dealId } = await ctx.params;
  const auth = await requirePermission(req, orgId, "credit.pull");
  if ("error" in auth) return auth.error;
  const { session } = auth;

  const deal = get<{ id: string; subJson: string; proposed: string; vehicleJson: string }>(
    "SELECT * FROM deals WHERE id = ? AND orgId = ?", dealId, orgId,
  );
  if (!deal) return jsonError("NOT_FOUND", "Deal not found", 404);

  // Invariant: consent must be granted and not withdrawn before any score.
  const consent = get("SELECT id FROM consents WHERE dealId = ? AND status = 'granted' ORDER BY createdAt DESC", deal.id);
  if (!consent) {
    return jsonError("CONSENT_REQUIRED", "Consent must be granted before a credit pull", 409);
  }

  const sub = JSON.parse(deal.subJson);
  const proposed = JSON.parse(deal.proposed);
  const vehicle = JSON.parse(deal.vehicleJson);

  const gnu = gnuGridMobileScore(sub.nin);

  const ruleRow = get<{ config: string }>("SELECT config FROM risk_rules WHERE orgId = ?", orgId);
  const rules = parseRules(ruleRow?.config ?? "{}");
  const result = computeRisk(rules, gnu.score, {
    assetValue: vehicle.value,
    desiredAmount: proposed.desiredAmount ?? vehicle.value * 0.7,
  });

  const assessmentId = newId();
  run(
    `INSERT INTO risk_assessments (id, dealId, gnuGridScore, internalAssetScore, combinedScore, tier, explanation, recommended, providerRef, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    assessmentId, deal.id, gnu.score, result.internalAssetScore, result.combinedScore,
    result.tier, JSON.stringify(result.explanation), JSON.stringify(result.recommended), gnu.reference, now(),
  );

  await audit(session, orgId, {
    action: "credit.pull",
    entityType: "deal",
    entityId: deal.id,
    after: { combinedScore: result.combinedScore, tier: result.tier, providerRef: gnu.reference },
    meta: { gnuGridRef: gnu.reference },
    ip: ipOf(req),
  });

  return NextResponse.json({ risk: result, assessmentId });
}
