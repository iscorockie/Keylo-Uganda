import { can, roles, type Permission, type Role } from './roles';

// Demo adapter: production should replace this with a signed session from Auth.js/your IdP.
export function requestContext(request: Request) {
  const candidate = request.headers.get('x-demo-role') ?? 'UNDERWRITER';
  const role = (roles.includes(candidate as Role) ? candidate : 'VIEWER') as Role;
  const organizationId = request.headers.get('x-organization-id') ?? 'demo-org';
  return { role, organizationId };
}
export function requirePermission(request: Request, permission: Permission) {
  const context = requestContext(request);
  if (!can(context.role, permission)) {
    return { ok: false as const, response: Response.json({ error: 'Forbidden', permission }, { status: 403 }) };
  }
  return { ok: true as const, context };
}
