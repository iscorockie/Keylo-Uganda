import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { all, get, run, now } from "@/lib/db";
import { createSessionToken, setSessionCookie, type SessionUser } from "@/lib/session";
import { jsonError } from "@/lib/api";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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
  const user = get<{ id: string; email: string; fullName: string; passwordHash: string }>(
    "SELECT * FROM users WHERE email = ?",
    email.toLowerCase(),
  );
  if (!user) return jsonError("UNAUTHENTICATED", "Invalid credentials", 401);

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return jsonError("UNAUTHENTICATED", "Invalid credentials", 401);

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
