import { NextResponse } from "next/server";
import { z } from "zod";
import { get, run, newId, now } from "@/lib/db";
import { requirePermission, jsonError, ipOf } from "@/lib/api";
import { audit } from "@/lib/audit";
import { issueOtp } from "@/lib/otp";

const body = z.object({ phone: z.string().min(1).optional() });

export async function POST(req: Request, ctx: { params: Promise<{ orgId: string; dealId: string }> }) {
  const { orgId, dealId } = await ctx.params;
  const auth = await requirePermission(req, orgId, "consent.create");
  if ("error" in auth) return auth.error;
  const { session } = auth;

  const deal = get<{ id: string; subJson: string }>(
    "SELECT * FROM deals WHERE id = ? AND orgId = ?", dealId, orgId,
  );
  if (!deal) return jsonError("NOT_FOUND", "Deal not found", 404);

  const existing = get("SELECT id FROM consents WHERE dealId = ? AND status = 'granted'", deal.id);
  if (existing) return jsonError("INVALID_STATE", "Consent already granted", 409);

  const sub = JSON.parse(deal.subJson);
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  const phone = parsed.success && parsed.data.phone ? parsed.data.phone : sub.phone;

  const { code, hash, reference } = await issueOtp();
  const consentId = newId();
  const ip = ipOf(req);
  const ua = req.headers.get("user-agent") ?? null;

  run(
    `INSERT INTO consents (id, orgId, dealId, subscriberId, method, phone, nin, status, otpReference, otpCodeHash, initiatedBy, ipAddress, userAgent, immutableHash, createdAt)
     VALUES (?, ?, ?, ?, 'otp', ?, ?, 'pending', ?, ?, ?, ?, ?, '', ?)`,
    consentId, orgId, deal.id, sub.nin, phone, sub.nin, reference, hash, session.userId, ip, ua, now(),
  );

  await audit(session, orgId, {
    action: "consent.otp_sent",
    entityType: "consent",
    entityId: consentId,
    meta: { otpReference: reference, phone },
    ip,
    userAgent: ua ?? undefined,
  });

  return NextResponse.json(
    { consentId, otpReference: reference, demoOtp: code },
    { status: 201 },
  );
}
