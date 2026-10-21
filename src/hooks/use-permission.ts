import { useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';

/** Pure check so it can be reused outside React (router guards, nav filtering). */
export function hasPermission(granted: string[] | undefined, required?: string | string[]) {
  if (!required || (Array.isArray(required) && required.length === 0)) return true;
  if (!granted?.length) return false;
  if (granted.includes('*')) return true;
  const needed = Array.isArray(required) ? required : [required];
  // Any of the required permissions is enough; "sales.*" grants every "sales.x.y".
  return needed.some(
    (perm) =>
      granted.includes(perm) || granted.some((g) => g.endsWith('.*') && perm.startsWith(g.slice(0, -1))),
  );
}

export function usePermission() {
  const permissions = useAuthStore((s) => s.user?.permissions);
  const can = useCallback(
    (required?: string | string[]) => hasPermission(permissions, required),
    [permissions],
  );
  return { can };
}
