import { NextResponse } from "next/server";
import { z } from "zod";
import { all, run, newId, now } from "@/lib/db";
import { requirePermission, jsonError } from "@/lib/api";

const dealBody = z.object({
  vehicle: z.object({
    plate: z.string().min(1),
    make: z.string().min(1),
    model: z.string().min(1),
    year: z.number().int().min(1980).max(2100),
    value: z.number().positive(),
  }),
  subscriber: z.object({
    nin: z.string().min(1),
    phone: z.string().min(1),
    name: z.string().min(1),
  }),
  proposed: z.object({ desiredAmount: z.number().positive() }).optional(),
});

type DealRow = {
  id: string;
  status: string;
  vehicleJson: string;
  subJson: string;
  proposed: string;
  decision: string | null;
  createdAt: string;
};

export async function GET(req: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await ctx.params;
  const auth = await requirePermission(req, orgId, "deal.read");
  if ("error" in auth) return auth.error;

  const deals = all<DealRow>("SELECT * FROM deals WHERE orgId = ? ORDER BY createdAt DESC LIMIT 200", orgId);

  return NextResponse.json({
    deals: deals.map((d) => ({
      id: d.id,
      status: d.status,
      vehicle: JSON.parse(d.vehicleJson),
      subscriber: JSON.parse(d.subJson),
      proposed: JSON.parse(d.proposed),
      decision: d.decision ? JSON.parse(d.decision) : null,
      createdAt: d.createdAt,
    })),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await ctx.params;
  const auth = await requirePermission(req, orgId, "deal.create");
  if ("error" in auth) return auth.error;
  const { session } = auth;

  const parsed = dealBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("VALIDATION", "Invalid deal payload", 422);
  const { vehicle, subscriber, proposed } = parsed.data;

  const id = newId();
  run(
    `INSERT INTO deals (id, orgId, createdBy, status, vehicleJson, subJson, proposed, createdAt, updatedAt)
     VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
    id,
    orgId,
    session.userId,
    JSON.stringify(vehicle),
    JSON.stringify(subscriber),
    JSON.stringify(proposed ?? { desiredAmount: vehicle.value * 0.7 }),
    now(),
    now(),
  );

  return NextResponse.json({ deal: { id, status: "draft" } }, { status: 201 });
}
