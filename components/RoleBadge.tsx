'use client';
import { useEffect, useState } from 'react';
import type { Role } from '../lib/roles';
export default function RoleBadge() {
  const [role, setRole] = useState<Role>('UNDERWRITER');
  useEffect(() => { fetch('/api/me').then(r => r.json()).then(data => data.role && setRole(data.role)).catch(() => undefined); }, []);
  return <span className="role-badge"><span className="role-dot"/> {role.replace('_', ' ')}</span>;
}
