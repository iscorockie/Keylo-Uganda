import { NextResponse } from "next/server";
import { all } from "@/lib/db";
import { requirePermission } from "@/lib/api";

export async function GET(req: Request, ctx: { params: Promise<{ orgId: string; dealId: string }> }) {
  const { orgId, dealId } = await ctx.params;
  const auth = await requirePermission(req, orgId, "consent.read");
  if ("error" in auth) return auth.error;

  const consents = all(
    "SELECT id, status, method, phone, grantedAt, withdrawnAt, withdrawReason, createdAt FROM consents WHERE dealId = ? AND orgId = ? ORDER BY createdAt DESC",
    dealId,
    orgId,
  );

  return NextResponse.json({ consents });
}
