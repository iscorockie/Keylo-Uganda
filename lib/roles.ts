export const roles = ['SUPER_ADMIN', 'ORG_ADMIN', 'UNDERWRITER', 'DEALER_STAFF', 'VIEWER'] as const;
export type Role = typeof roles[number];
export type Permission = 'deal:create' | 'deal:edit' | 'deal:view' | 'deal:score' | 'deal:adjust' | 'decision:make' | 'decision:request-info' | 'policy:manage' | 'users:manage' | 'org:manage' | 'reports:view' | 'audit:export' | 'consent:manage' | 'consent:view' | 'payments:configure' | 'platform:manage';

export const permissions: Record<Role, Permission[]> = {
  DEALER_STAFF: ['deal:create', 'deal:edit', 'deal:view', 'deal:score', 'deal:adjust', 'consent:view'],
  UNDERWRITER: ['deal:create', 'deal:edit', 'deal:view', 'deal:score', 'deal:adjust', 'decision:make', 'decision:request-info', 'reports:view', 'audit:export', 'consent:view'],
  ORG_ADMIN: ['deal:create', 'deal:edit', 'deal:view', 'deal:score', 'deal:adjust', 'decision:make', 'decision:request-info', 'policy:manage', 'users:manage', 'org:manage', 'reports:view', 'audit:export', 'consent:manage', 'consent:view', 'payments:configure'],
  VIEWER: ['deal:view', 'reports:view', 'consent:view'],
  SUPER_ADMIN: ['deal:create', 'deal:edit', 'deal:view', 'deal:score', 'deal:adjust', 'decision:make', 'decision:request-info', 'policy:manage', 'users:manage', 'org:manage', 'reports:view', 'audit:export', 'consent:manage', 'consent:view', 'payments:configure', 'platform:manage'],
};
export function can(role: Role, permission: Permission) { return permissions[role].includes(permission); }
