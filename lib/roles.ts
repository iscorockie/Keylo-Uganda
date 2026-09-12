export const roles = ['DEALER_STAFF', 'UNDERWRITER', 'ORG_ADMIN', 'SUPER_ADMIN'] as const;
export type Role = typeof roles[number];
export type Permission = 'deal:create' | 'deal:view' | 'deal:score' | 'decision:make' | 'policy:manage' | 'users:manage' | 'org:manage' | 'audit:export' | 'platform:manage';

export const permissions: Record<Role, Permission[]> = {
  DEALER_STAFF: ['deal:create', 'deal:view'],
  UNDERWRITER: ['deal:create', 'deal:view', 'deal:score', 'decision:make', 'audit:export'],
  ORG_ADMIN: ['deal:create', 'deal:view', 'deal:score', 'decision:make', 'policy:manage', 'users:manage', 'org:manage', 'audit:export'],
  SUPER_ADMIN: ['deal:create', 'deal:view', 'deal:score', 'decision:make', 'policy:manage', 'users:manage', 'org:manage', 'audit:export', 'platform:manage'],
};
export function can(role: Role, permission: Permission) { return permissions[role].includes(permission); }
