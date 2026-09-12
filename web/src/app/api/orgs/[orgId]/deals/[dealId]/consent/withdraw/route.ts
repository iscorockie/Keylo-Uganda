import { NextResponse } from "next/server";
import { z } from "zod";
import { get, run, now } from "@/lib/db";
import { requirePermission, jsonError, ipOf } from "@/lib/api";
import { audit } from "@/lib/audit";

const body = z.object({ reason: z.string().min(1) });

export async function POST(req: Request, ctx: { params: Promise<{ orgId: string; dealId: string }> }) {
  const { orgId, dealId } = await ctx.params;
  const auth = await requirePermission(req, orgId, "consent.withdraw");
  if ("error" in auth) return auth.error;
  const { session } = auth;

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("VALIDATION", "Reason required", 422);

  const consent = get<{ id: string }>(
    "SELECT * FROM consents WHERE dealId = ? AND orgId = ? AND status = 'granted' ORDER BY createdAt DESC",
    dealId, orgId,
  );
  if (!consent) return jsonError("NOT_FOUND", "No granted consent to withdraw", 404);

  run(
    "UPDATE consents SET status = 'withdrawn', withdrawnAt = ?, withdrawnBy = ?, withdrawReason = ? WHERE id = ?",
    now(), session.userId, parsed.data.reason, consent.id,
  );

  await audit(session, orgId, {
    action: "consent.withdrawn",
    entityType: "consent",
    entityId: consent.id,
    before: { status: "granted" },
    after: { status: "withdrawn" },
    meta: { withdrawnBy: session.userId, reason: parsed.data.reason },
    ip: ipOf(req),
  });

  return NextResponse.json({ consent: { id: consent.id, status: "withdrawn" } });
}
