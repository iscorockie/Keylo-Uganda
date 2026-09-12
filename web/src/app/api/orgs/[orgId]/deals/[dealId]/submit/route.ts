import { NextResponse } from "next/server";
import { get, run, now } from "@/lib/db";
import { requirePermission, jsonError } from "@/lib/api";

export async function POST(req: Request, ctx: { params: Promise<{ orgId: string; dealId: string }> }) {
  const { orgId, dealId } = await ctx.params;
  const auth = await requirePermission(req, orgId, "deal.submit");
  if ("error" in auth) return auth.error;

  const deal = get<{ id: string; status: string }>(
    "SELECT * FROM deals WHERE id = ? AND orgId = ?", dealId, orgId,
  );
  if (!deal) return jsonError("NOT_FOUND", "Deal not found", 404);
  if (deal.status !== "draft" && deal.status !== "info_requested") {
    return jsonError("INVALID_STATE", `Cannot submit a deal in status '${deal.status}'`, 409);
  }

  run("UPDATE deals SET status = 'submitted', updatedAt = ? WHERE id = ?", now(), deal.id);

  return NextResponse.json({ deal: { id: deal.id, status: "submitted" } });
}
