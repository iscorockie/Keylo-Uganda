import { NextResponse } from "next/server";
import { z } from "zod";
import { all, get, run, now } from "@/lib/db";
import { createSessionToken, setSessionCookie, type SessionUser } from "@/lib/session";
import { jsonError, ipOf } from "@/lib/api";
import { verifyAgainst } from "@/lib/password";
import { rateLimit, clearRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type MemberRow = {
  orgId: string;
  orgName: string;
  orgSlug: string;
  roleKey: string;
};

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("VALIDATION", "Email and password required", 422);

  const { email, password } = parsed.data;
  const ip = ipOf(req);
  const rlKey = `${email.toLowerCase()}|${ip}`;

  // Brute-force protection: 5 attempts per minute per email+IP.
  if (!rateLimit(rlKey)) {
    return jsonError("RATE_LIMITED", "Too many attempts. Try again in a minute.", 429);
  }

  const user = get<{ id: string; email: string; fullName: string; passwordHash: string | null }>(
    "SELECT * FROM users WHERE email = ?",
    email.toLowerCase(),
  );

  // Always run a compare (against a dummy hash when the user doesn't exist) so
  // response timing doesn't reveal whether an account exists.
  const ok = await verifyAgainst(password, user?.passwordHash);
  if (!user || !ok) {
    return jsonError("UNAUTHENTICATED", "Invalid credentials", 401);
  }

  clearRateLimit(rlKey);

  const members = all<MemberRow>(
    `SELECT m.orgId, o.name AS orgName, o.slug AS orgSlug, r.key AS roleKey
     FROM organization_members m
     JOIN organizations o ON o.id = m.orgId
     JOIN roles r ON r.id = m.roleId
     WHERE m.userId = ? AND m.status = 'active'`,
    user.id,
  );

  const memberships = members.map((m) => {
    const perms = all<{ code: string }>(
      `SELECT p.code FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permissionId
       JOIN roles r ON r.id = rp.roleId
       WHERE r.key = ?`,
      m.roleKey,
    ).map((p) => p.code);
    return {
      orgId: m.orgId,
      orgName: m.orgName,
      orgSlug: m.orgSlug,
      role: m.roleKey,
      permissions: perms,
    };
  });

  const sessionUser: SessionUser = {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    memberships,
  };

  run("UPDATE users SET lastLoginAt = ? WHERE id = ?", now(), user.id);

  const token = await createSessionToken(sessionUser);
  await setSessionCookie(token);

  return NextResponse.json({ user: sessionUser });
}
