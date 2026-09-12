import { NextResponse } from "next/server";
import { z } from "zod";
import { get, run, now } from "@/lib/db";
import { requirePermission, jsonError, ipOf } from "@/lib/api";
import { audit } from "@/lib/audit";
import { can } from "@/lib/authz";

const body = z.object({
  type: z.enum(["approve", "decline", "request_info"]),
  reason: z.string().optional(),
  structure: z
    .object({
      deposit: z.number(),
      termMonths: z.number().int(),
      monthlyAmount: z.number(),
    })
    .optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ orgId: string; dealId: string }> }) {
  const { orgId, dealId } = await ctx.params;
  const auth = await requirePermission(req, orgId, "deal.read");
  if ("error" in auth) return auth.error;
  const { session } = auth;

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("VALIDATION", "Invalid decision payload", 422);
  const { type, reason, structure } = parsed.data;

  const permission =
    type === "approve" ? "decision.approve" : type === "decline" ? "decision.decline" : "decision.request_info";

  if (!can(session, orgId, permission)) {
    return jsonError("FORBIDDEN", `Missing permission: ${permission}`, 403);
  }

  const deal = get<{ id: string; status: string; decision: string | null }>(
    "SELECT * FROM deals WHERE id = ? AND orgId = ?", dealId, orgId,
  );
  if (!deal) return jsonError("NOT_FOUND", "Deal not found", 404);
  if (deal.status !== "submitted" && deal.status !== "in_review") {
    return jsonError("INVALID_STATE", `Cannot decide a deal in status '${deal.status}'`, 409);
  }

  const before = { status: deal.status, decision: deal.decision ? JSON.parse(deal.decision) : null };

  let newStatus: string;
  let decision: unknown = null;
  if (type === "approve") {
    newStatus = "approved";
    decision = { type, at: now(), structure: structure ?? null };
  } else if (type === "decline") {
    newStatus = "declined";
    decision = { type, at: now() };
  } else {
    newStatus = "info_requested";
    decision = { type, at: now(), reason: reason ?? null };
  }

  run(
    "UPDATE deals SET status = ?, decision = ?, declinedReason = ?, updatedAt = ? WHERE id = ?",
    newStatus, JSON.stringify(decision), type === "decline" ? (reason ?? null) : null, now(), deal.id,
  );

  await audit(session, orgId, {
    action: `decision.${type}`,
    entityType: "deal",
    entityId: deal.id,
    before,
    after: { status: newStatus, decision, reason: reason ?? null },
    meta: { reason: reason ?? null },
    ip: ipOf(req),
  });

  return NextResponse.json({ deal: { id: deal.id, status: newStatus } });
}
