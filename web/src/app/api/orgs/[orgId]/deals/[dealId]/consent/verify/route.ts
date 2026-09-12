import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { get, run, now } from "@/lib/db";
import { requirePermission, jsonError, ipOf } from "@/lib/api";
import { audit } from "@/lib/audit";
import { verifyOtp } from "@/lib/otp";

const body = z.object({ otp: z.string().min(4) });

export async function POST(req: Request, ctx: { params: Promise<{ orgId: string; dealId: string }> }) {
  const { orgId, dealId } = await ctx.params;
  const auth = await requirePermission(req, orgId, "consent.create");
  if ("error" in auth) return auth.error;
  const { session } = auth;

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("VALIDATION", "OTP required", 422);

  const consent = get<{ id: string; otpCodeHash: string | null; nin: string; phone: string; initiatedBy: string }>(
    "SELECT * FROM consents WHERE dealId = ? AND orgId = ? AND status = 'pending' ORDER BY createdAt DESC",
    dealId, orgId,
  );
  if (!consent) return jsonError("NOT_FOUND", "No pending consent request", 404);
  if (!consent.otpCodeHash) return jsonError("INVALID_STATE", "Consent not in OTP state", 409);

  const ok = await verifyOtp(parsed.data.otp, consent.otpCodeHash);
  if (!ok) {
    run("UPDATE consents SET status = 'failed' WHERE id = ?", consent.id);
    return jsonError("VALIDATION", "Invalid OTP", 422);
  }

  const immutableHash = createHash("sha256")
    .update(`${consent.id}|${consent.nin}|${consent.phone}|otp|${now()}`)
    .digest("hex");

  run(
    "UPDATE consents SET status = 'granted', grantedAt = ?, immutableHash = ? WHERE id = ?",
    now(), immutableHash, consent.id,
  );

  await audit(session, orgId, {
    action: "consent.granted",
    entityType: "consent",
    entityId: consent.id,
    after: { status: "granted", method: "otp" },
    meta: { initiatedBy: consent.initiatedBy },
    ip: ipOf(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ consent: { id: consent.id, status: "granted", grantedAt: now() } });
}
