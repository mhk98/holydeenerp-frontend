import type { ReactNode } from 'react';
import { usePermission } from '@/hooks/use-permission';

interface CanProps {
  /** One key or a list — any of them is enough. */
  permission: string | string[];
  children: ReactNode;
  /** Rendered when the permission is missing (default: nothing). */
  fallback?: ReactNode;
}

/**
 * Permission-aware rendering:
 *   <Can permission="users.create"><Button>New user</Button></Can>
 */
export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = usePermission();
  return can(permission) ? children : fallback;
};
